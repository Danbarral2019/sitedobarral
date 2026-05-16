/**
 * Codemod: console.error → apiLogger.error
 *
 * Usa ts-morph (AST) em vez de regex para evitar bugs com template literals,
 * ternaries multilinhas e outros casos que quebraram a tentativa anterior em Python.
 *
 * Transformações:
 *   console.error('msg')                  → apiLogger.error('msg')
 *   console.error('msg', err)             → apiLogger.error({ err }, 'msg')
 *   console.error('msg', { foo: bar })    → apiLogger.error({ foo: bar }, 'msg')  // 2º já é objeto
 *   console.error(err)                    → apiLogger.error(err)
 *   console.error('a', 'b', 'c')          → SKIP + warning (3+ args ambíguo)
 *
 * Uso:
 *   npx tsx scripts/codemods/migrate-console-error.ts <dir> [<dir>...] [--dry]
 *
 * Exemplos:
 *   npx tsx scripts/codemods/migrate-console-error.ts app/api/admin
 *   npx tsx scripts/codemods/migrate-console-error.ts lib --dry
 */

import { Project, SyntaxKind, Node, type SourceFile, type CallExpression } from 'ts-morph';
import path from 'node:path';
import { argv } from 'node:process';

interface Stats {
  filesScanned: number;
  filesChanged: number;
  migrated1Arg: number;
  migrated2Args: number;
  skipped3PlusArgs: number;
  skippedAlreadyMigrated: number;
  importsAdded: number;
}

const stats: Stats = {
  filesScanned: 0,
  filesChanged: 0,
  migrated1Arg: 0,
  migrated2Args: 0,
  skipped3PlusArgs: 0,
  skippedAlreadyMigrated: 0,
  importsAdded: 0,
};

const warnings: string[] = [];

function isConsoleError(call: CallExpression): boolean {
  const expr = call.getExpression();
  if (!Node.isPropertyAccessExpression(expr)) return false;
  if (expr.getName() !== 'error') return false;
  const target = expr.getExpression();
  return Node.isIdentifier(target) && target.getText() === 'console';
}

function hasApiLoggerImport(sf: SourceFile): boolean {
  return sf.getImportDeclarations().some((imp) => {
    const spec = imp.getModuleSpecifierValue();
    if (spec !== '@/lib/logger') return false;
    return imp.getNamedImports().some((n) => n.getName() === 'apiLogger');
  });
}

function addApiLoggerImport(sf: SourceFile): void {
  const existing = sf.getImportDeclaration((imp) => imp.getModuleSpecifierValue() === '@/lib/logger');
  if (existing) {
    existing.addNamedImport('apiLogger');
  } else {
    sf.addImportDeclaration({
      moduleSpecifier: '@/lib/logger',
      namedImports: ['apiLogger'],
    });
  }
  stats.importsAdded++;
}

function transformCall(call: CallExpression, sf: SourceFile, filePath: string): boolean {
  const args = call.getArguments();

  // Caso 0 args: console.error() — ignora (não faz sentido, mas safe)
  if (args.length === 0) return false;

  // Caso 1 arg: só renomeia
  if (args.length === 1) {
    const expr = call.getExpression();
    expr.replaceWithText('apiLogger.error');
    stats.migrated1Arg++;
    return true;
  }

  // Caso 2 args
  if (args.length === 2) {
    const [first, second] = args;
    const firstText = first.getText();
    const secondText = second.getText();

    // Se primeiro arg já é objeto literal { ... }, é provável que já esteja no formato Pino
    // (foi migrado antes). Apenas renomeia console.error → apiLogger.error.
    if (Node.isObjectLiteralExpression(first)) {
      const expr = call.getExpression();
      expr.replaceWithText('apiLogger.error');
      stats.skippedAlreadyMigrated++;
      return true;
    }

    // Padrão típico: console.error('msg', err) → apiLogger.error({ err }, 'msg')
    // Se segundo arg já é object literal, usa direto: apiLogger.error({ foo: bar }, 'msg')
    let objArg: string;
    if (Node.isObjectLiteralExpression(second)) {
      objArg = secondText;
    } else {
      objArg = `{ err: ${secondText} }`;
    }

    call.replaceWithText(`apiLogger.error(${objArg}, ${firstText})`);
    stats.migrated2Args++;
    return true;
  }

  // 3+ args — ambíguo, skip
  const line = call.getStartLineNumber();
  warnings.push(`  ⚠️  ${path.relative(process.cwd(), filePath)}:${line} — ${args.length} args, skip (manual)`);
  stats.skipped3PlusArgs++;
  return false;
}

function processFile(filePath: string, project: Project, dryRun: boolean): void {
  stats.filesScanned++;
  const sf = project.addSourceFileAtPath(filePath);

  let changed = false;
  let needsImport = false;

  // Coleta todas as CallExpressions primeiro (evitar mutar enquanto itera)
  const consoleErrorCalls: CallExpression[] = [];
  sf.forEachDescendant((node) => {
    if (Node.isCallExpression(node) && isConsoleError(node)) {
      consoleErrorCalls.push(node);
    }
  });

  for (const call of consoleErrorCalls) {
    if (transformCall(call, sf, filePath)) {
      changed = true;
      // Se foi 1-arg ou 2-args sem objeto-já-migrado, precisa do import
      needsImport = true;
    }
  }

  if (!changed) {
    project.removeSourceFile(sf);
    return;
  }

  if (needsImport && !hasApiLoggerImport(sf)) {
    addApiLoggerImport(sf);
  }

  stats.filesChanged++;

  if (!dryRun) {
    sf.saveSync();
  }

  console.log(`  ✓ ${path.relative(process.cwd(), filePath)} (${consoleErrorCalls.length} calls)`);
}

function findTsFiles(dirs: string[]): string[] {
  // Usa o Project pra resolver glob via tsconfig
  const tempProject = new Project({
    tsConfigFilePath: './tsconfig.json',
    skipAddingFilesFromTsConfig: false,
  });

  const files: string[] = [];
  for (const dir of dirs) {
    const absDir = path.resolve(dir);
    const matched = tempProject.getSourceFiles().filter((sf) => {
      const fp = sf.getFilePath();
      return fp.startsWith(absDir) && !fp.includes('__tests__') && !fp.endsWith('.test.ts') && !fp.endsWith('.test.tsx');
    });
    files.push(...matched.map((sf) => sf.getFilePath()));
  }
  return [...new Set(files)];
}

async function main(): Promise<void> {
  const args = argv.slice(2);
  const dryRun = args.includes('--dry');
  const dirs = args.filter((a) => !a.startsWith('--'));

  if (dirs.length === 0) {
    console.error('Uso: npx tsx scripts/codemods/migrate-console-error.ts <dir> [<dir>...] [--dry]');
    process.exit(1);
  }

  console.log(`🔍 Modo: ${dryRun ? 'DRY RUN' : 'APLICAR'}`);
  console.log(`📂 Dirs: ${dirs.join(', ')}\n`);

  const files = findTsFiles(dirs);
  console.log(`📄 ${files.length} arquivos elegíveis (excluindo tests)\n`);

  // Usa um Project novo para o processamento real (sem cache do findTsFiles)
  const project = new Project({
    tsConfigFilePath: './tsconfig.json',
    skipAddingFilesFromTsConfig: true,
  });

  for (const file of files) {
    processFile(file, project, dryRun);
  }

  console.log(`\n📊 Stats:`);
  console.log(`   Arquivos escaneados: ${stats.filesScanned}`);
  console.log(`   Arquivos alterados:  ${stats.filesChanged}`);
  console.log(`   1-arg migrados:      ${stats.migrated1Arg}`);
  console.log(`   2-args migrados:     ${stats.migrated2Args}`);
  console.log(`   Já no formato Pino:  ${stats.skippedAlreadyMigrated}`);
  console.log(`   3+ args (skip):      ${stats.skipped3PlusArgs}`);
  console.log(`   Imports adicionados: ${stats.importsAdded}`);

  if (warnings.length > 0) {
    console.log(`\n⚠️  Warnings (revisar manualmente):`);
    warnings.forEach((w) => console.log(w));
  }

  if (dryRun) {
    console.log(`\n💡 DRY RUN — nenhum arquivo foi alterado. Re-rode sem --dry para aplicar.`);
  }
}

main().catch((err) => {
  console.error('Codemod falhou:', err);
  process.exit(1);
});
