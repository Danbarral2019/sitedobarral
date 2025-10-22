# 📚 Referência de IDs dos Cursos

**IMPORTANTE:** Sempre use o `id` (numérico), NÃO o `slug` ao referenciar cursos no banco de dados!

## Lista Completa dos 10 Cursos

| ID | Slug | Título |
|---|---|---|
| `'1'` | `nova-lei-licitacoes` | Nova Lei de Licitações e Contratos (Lei nº 14.133/2021) |
| `'2'` | `planejamento-contratacoes` | Planejamento das Contratações Públicas |
| `'3'` | `gestao-fiscalizacao-contratos` | Gestão e Fiscalização de Contratos Administrativos |
| `'4'` | `processo-sancionador` | Processo Administrativo Sancionador |
| `'5'` | `inovacao-contratacoes` | Inovação nas Contratações Públicas |
| `'6'` | `terceirizacao-formacao-precos` | Terceirização e Formação de Preços |
| `'7'` | `assessoramento-juridico` | Assessoramento Jurídico na Nova Lei de Licitações |
| `'8'` | `revisao-reajuste-repactuacao` | Revisão, Reajuste e Repactuação |
| `'9'` | `alteracoes-contratuais` | Alterações Contratuais |
| `'10'` | `contratacao-direta` | Contratação Direta |

## Quando Usar ID vs Slug

### ✅ Use `id` (numérico):
- Enrollment.courseId (matrícula no banco)
- Document.courseId (documentos no banco)
- QRCode.courseId (QR codes no banco)
- Qualquer relação com banco de dados
- APIs que manipulam dados

### ✅ Use `slug`:
- URLs das páginas (`/cursos/[slug]`)
- Links no frontend
- Rotas dinâmicas do Next.js
- SEO e compartilhamento

## Exemplos Corretos

### ❌ ERRADO (vai causar erro):
```typescript
// Criando matrícula
await prisma.enrollment.create({
  data: {
    userId: user.id,
    courseId: 'nova-lei-licitacoes', // ❌ Usando slug!
  }
});
```

### ✅ CORRETO:
```typescript
// Criando matrícula
await prisma.enrollment.create({
  data: {
    userId: user.id,
    courseId: '1', // ✅ Usando ID!
  }
});
```

### ✅ CORRETO (com busca):
```typescript
// Encontrar curso por slug para pegar o ID
const course = courses.find(c => c.slug === 'nova-lei-licitacoes');
if (course) {
  await prisma.enrollment.create({
    data: {
      userId: user.id,
      courseId: course.id, // ✅ Usando ID do curso encontrado!
    }
  });
}
```

## Scripts de Teste

Sempre use os IDs numéricos nos scripts de teste:

```javascript
// ✅ CORRETO
const courseId = '1'; // Nova Lei de Licitações

// ❌ ERRADO
const courseId = 'nova-lei-licitacoes';
```

## Conversão Rápida

Use este helper quando precisar converter:

```typescript
import { courses } from '@/data/courses';

// Slug → ID
function getIdFromSlug(slug: string): string | undefined {
  return courses.find(c => c.slug === slug)?.id;
}

// ID → Slug
function getSlugFromId(id: string): string | undefined {
  return courses.find(c => c.id === id)?.slug;
}

// ID → Curso completo
function getCourseById(id: string) {
  return courses.find(c => c.id === id);
}
```

---

**Última atualização:** 2025-10-22
