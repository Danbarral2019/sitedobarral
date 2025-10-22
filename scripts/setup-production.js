/**
 * Script para configurar ambiente de produção
 * Executar APÓS o primeiro deploy na Vercel
 *
 * Uso:
 * DATABASE_URL="postgresql://..." node scripts/setup-production.js
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function setupProduction() {
  console.log('\n🚀 CONFIGURANDO AMBIENTE DE PRODUÇÃO\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    // Verificar conexão com banco
    await prisma.$connect();
    console.log('✅ Conexão com banco de dados estabelecida\n');

    // 1. Criar usuário admin
    console.log('👤 Criando usuário administrador...\n');

    const adminEmail = 'admin@profbarral.com.br';
    const adminPassword = process.env.ADMIN_PASSWORD || 'MudeEssaSenha123!';
    const adminName = 'Prof. Daniel Barral';

    const existingAdmin = await prisma.user.findUnique({
      where: { email: adminEmail }
    });

    if (existingAdmin) {
      console.log('⚠️  Admin já existe. Pulando...\n');
    } else {
      const passwordHash = await bcrypt.hash(adminPassword, 10);

      await prisma.user.create({
        data: {
          email: adminEmail,
          name: adminName,
          passwordHash,
          role: 'admin',
          emailVerified: true,
        },
      });

      console.log('✅ Administrador criado com sucesso!');
      console.log(`   Email: ${adminEmail}`);
      console.log(`   Senha: ${adminPassword}`);
      console.log('   ⚠️  IMPORTANTE: Altere a senha após o primeiro login!\n');
    }

    // 2. Estatísticas do banco
    console.log('📊 Estatísticas do banco de dados:\n');

    const stats = {
      users: await prisma.user.count(),
      admins: await prisma.user.count({ where: { role: 'admin' } }),
      students: await prisma.user.count({ where: { role: 'student' } }),
      qrCodes: await prisma.qRCode.count(),
      enrollments: await prisma.enrollment.count(),
      documents: await prisma.document.count(),
      blogPosts: await prisma.blogPost.count(),
      publications: await prisma.publication.count(),
    };

    console.log(`   Usuários totais: ${stats.users}`);
    console.log(`   └─ Admins: ${stats.admins}`);
    console.log(`   └─ Alunos: ${stats.students}`);
    console.log(`   QR Codes: ${stats.qrCodes}`);
    console.log(`   Matrículas: ${stats.enrollments}`);
    console.log(`   Documentos: ${stats.documents}`);
    console.log(`   Posts do Blog: ${stats.blogPosts}`);
    console.log(`   Publicações: ${stats.publications}\n`);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ CONFIGURAÇÃO CONCLUÍDA COM SUCESSO!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('🌐 PRÓXIMOS PASSOS:\n');
    console.log('1. Acesse: https://seu-projeto.vercel.app/admin/login');
    console.log('2. Faça login com as credenciais acima');
    console.log('3. Altere a senha em: /admin/redefinir-senha');
    console.log('4. Comece a usar o sistema!\n');

  } catch (error) {
    console.error('\n❌ ERRO ao configurar produção:', error);
    console.error('\nDetalhes:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

setupProduction();
