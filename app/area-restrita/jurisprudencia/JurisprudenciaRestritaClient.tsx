'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
 Gavel,
 Sparkles,
 Filter,
 X,
 Loader2,
 ExternalLink,
 Search,
 BookOpen,
 ThumbsUp,
 ThumbsDown,
} from 'lucide-react';
import FeedbackTipBanner from '@/components/area-restrita/FeedbackTipBanner';

interface DecisionItem {
 id: string;
 tribunalCode: string;
 tribunalName: string;
 decisionType: string;
 decisionNumber: string;
 title: string;
 ementa: string;
 summary: string | null;
 relator: string | null;
 orgaoJulgador: string | null;
 dataJulgamento: string | null;
 themes: string | null;
 leiArticles: string | null;
 url: string | null;
}

interface ListResponse {
 items: DecisionItem[];
 total: number;
 page: number;
 pageSize: number;
 totalPages: number;
}

interface AIAnswer {
 answer: string;
 sources: Array<{
 id: string;
 tribunalCode: string;
 decisionType: string;
 decisionNumber: string;
 title: string;
 url: string | null;
 }>;
 consulted: number;
 searchHistoryId?: string | null;
}

interface Filters {
 tribunal: string;
 ano: string;
 tema: string;
 artigo: string;
 decisionType: string;
 q: string;
}

const EMPTY_FILTERS: Filters = {
 tribunal: '',
 ano: '',
 tema: '',
 artigo: '',
 decisionType: '',
 q: '',
};

const TRIBUNAIS = [
 { code: 'TCU', label: 'TCU — Tribunal de Contas da União' },
 { code: 'TCE-SP', label: 'TCE-SP — Tribunal de Contas de SP' },
 { code: 'TCE-PR', label: 'TCE-PR — Tribunal de Contas do PR' },
 { code: 'TCE-MG', label: 'TCE-MG — Tribunal de Contas de MG' },
 { code: 'TCE-RS', label: 'TCE-RS — Tribunal de Contas do RS' },
 { code: 'STJ', label: 'STJ — Superior Tribunal de Justiça' },
 { code: 'STF', label: 'STF — Supremo Tribunal Federal' },
 { code: 'TST', label: 'TST — Tribunal Superior do Trabalho (Súmulas)' },
];

const TIPOS_DECISAO = [
 { code: 'acordao', label: 'Acórdão' },
 { code: 'decisao', label: 'Decisão' },
 { code: 'parecer_previo', label: 'Parecer Prévio' },
 { code: 'sumula', label: 'Súmula' },
];

const TEMAS_SUGERIDOS = [
 'licitação',
 'pregão eletrônico',
 'dispensa de licitação',
 'inexigibilidade',
 'contrato administrativo',
 'fiscalização',
 'sanção administrativa',
 'planejamento',
 'matriz de risco',
];

function parseJsonArray(value: string | null): string[] {
 if (!value) return [];
 try {
 const parsed = JSON.parse(value);
 return Array.isArray(parsed) ? parsed : [];
 } catch {
 return [];
 }
}

function tribunalBadgeColor(code: string): string {
 if (code.startsWith('TCU')) return 'bg-surface-deep text-ink-primary';
 if (code.startsWith('STF')) return 'bg-surface-deep text-ink-primary';
 if (code.startsWith('STJ')) return 'bg-surface-deep text-ink-primary';
 if (code.startsWith('TCE')) return 'bg-surface-deep text-ink-primary';
 return 'bg-surface-deep text-ink-primary';
}

function buildQueryString(filters: Filters, page: number, pageSize = 10): string {
 const params = new URLSearchParams();
 if (filters.tribunal) params.set('tribunal', filters.tribunal);
 if (filters.ano) params.set('ano', filters.ano);
 if (filters.tema) params.set('tema', filters.tema);
 if (filters.artigo) params.set('artigo', filters.artigo);
 if (filters.decisionType) params.set('decisionType', filters.decisionType);
 if (filters.q) params.set('q', filters.q);
 params.set('page', String(page));
 params.set('pageSize', String(pageSize));
 return params.toString();
}

export default function JurisprudenciaRestritaClient() {
 const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
 const [page, setPage] = useState(1);
 const [list, setList] = useState<ListResponse | null>(null);
 const [loadingList, setLoadingList] = useState(false);
 const [listError, setListError] = useState<string | null>(null);

 const [aiQuery, setAiQuery] = useState('');
 const [aiAnswer, setAiAnswer] = useState<AIAnswer | null>(null);
 const [aiFeedback, setAiFeedback] = useState<1 | -1 | null>(null);
 const [loadingAi, setLoadingAi] = useState(false);
 const [aiError, setAiError] = useState<string | null>(null);

 const [showFilters, setShowFilters] = useState(true);

 const years = useMemo(() => {
 const now = new Date().getFullYear();
 return Array.from({ length: 11 }, (_, i) => now - i);
 }, []);

 const fetchList = useCallback(async (f: Filters, p: number) => {
 setLoadingList(true);
 setListError(null);
 try {
 const qs = buildQueryString(f, p);
 const res = await fetch(`/api/jurisprudencia?${qs}`);
 if (!res.ok) throw new Error('Falha ao buscar decisões');
 const data: ListResponse = await res.json();
 setList(data);
 } catch (e) {
 setListError(e instanceof Error ? e.message : 'Erro desconhecido');
 } finally {
 setLoadingList(false);
 }
 }, []);

 useEffect(() => {
 fetchList(filters, page);
 }, [fetchList, filters, page]);

 const handleFilterChange = (key: keyof Filters, value: string) => {
 setFilters(prev => ({ ...prev, [key]: value }));
 setPage(1);
 };

 const clearFilters = () => {
 setFilters(EMPTY_FILTERS);
 setPage(1);
 };

 const hasActiveFilters = Object.values(filters).some(v => v !== '');

 const submitAiFeedback = async (value: 1 | -1) => {
 if (!aiAnswer?.searchHistoryId) return;
 const newValue: 1 | -1 | null = aiFeedback === value ? null : value;
 const prev = aiFeedback;
 setAiFeedback(newValue);
 try {
 const res = await fetch(
 `/api/area-restrita/search-history/${aiAnswer.searchHistoryId}/feedback`,
 {
 method: 'PATCH',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ feedback: newValue }),
 },
 );
 if (!res.ok) throw new Error('feedback-failed');
 } catch {
 setAiFeedback(prev);
 }
 };

 const askAI = async () => {
 if (aiQuery.trim().length < 3) {
 setAiError('Digite uma pergunta com pelo menos 3 caracteres.');
 return;
 }
 setLoadingAi(true);
 setAiError(null);
 setAiAnswer(null);
 setAiFeedback(null);
 try {
 const res = await fetch('/api/jurisprudencia/query', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 query: aiQuery,
 filters: {
 tribunal: filters.tribunal || undefined,
 year: filters.ano ? parseInt(filters.ano, 10) : undefined,
 theme: filters.tema || undefined,
 leiArticle: filters.artigo || undefined,
 decisionType: filters.decisionType || undefined,
 q: filters.q || undefined,
 },
 }),
 });
 if (!res.ok) {
 const msg = res.status === 401 ? 'Faça login para usar a IA.' : 'Falha na consulta com IA';
 throw new Error(msg);
 }
 const data: AIAnswer = await res.json();
 setAiAnswer(data);
 } catch (e) {
 setAiError(e instanceof Error ? e.message : 'Erro desconhecido');
 } finally {
 setLoadingAi(false);
 }
 };

 return (
 <div className="min-h-screen bg-surface-raised">
 <div className="max-w-7xl mx-auto px-4 py-6 lg:py-10">
 {/* Header */}
 <div className="mb-6">
 <div className="flex items-start gap-4">
 <div className="p-3 bg-surface-raised rounded-md shrink-0">
 <Gavel className="w-8 h-8 text-brand-600" />
 </div>
 <div>
 <h1 className="text-2xl lg:text-3xl font-bold text-ink-primary">
 Jurisprudência com IA
 </h1>
 <p className="text-ink-secondary mt-1 max-w-3xl">
 Pesquise decisões de TCU, STJ, STF e tribunais de contas estaduais. Use filtros para
 refinar e peça à IA para analisar os resultados com fundamento na Lei 14.133/2021.
 </p>
 </div>
 </div>
 </div>

 <FeedbackTipBanner />

 {/* Ask AI box */}
 <section className="bg-surface-page rounded-md border border-border-subtle p-6 mb-6">
 <div className="flex items-center gap-2 mb-3">
 <Sparkles className="w-5 h-5 text-amber-accent" />
 <h2 className="font-bold text-ink-primary">Pergunte à IA</h2>
 </div>
 <p className="text-sm text-ink-muted mb-4">
 A IA responderá com base nas decisões que casam com os filtros ativos (ou em toda a base
 se nenhum filtro estiver aplicado).
 </p>
 <div className="flex flex-col sm:flex-row gap-3">
 <textarea
 value={aiQuery}
 onChange={e => setAiQuery(e.target.value)}
 placeholder="Ex: Qual o entendimento atual sobre sanções por descumprimento de prazos contratuais?"
 className="flex-1 min-h-[80px] rounded-[3px] border border-border-strong px-3 py-2 text-sm focus:ring-2 focus:ring-amber-accent focus:border-brand-600 outline-none resize-none"
 disabled={loadingAi}
 />
 <button
 onClick={askAI}
 disabled={loadingAi || aiQuery.trim().length < 3}
 className="sm:self-start inline-flex items-center justify-center gap-2 px-5 py-3 bg-brand-600 text-surface-page font-medium rounded-[3px] hover:bg-brand-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
 >
 {loadingAi ? (
 <>
 <Loader2 className="w-4 h-4 animate-spin" />
 Consultando
 </>
 ) : (
 <>
 <Sparkles className="w-4 h-4" />
 Perguntar
 </>
 )}
 </button>
 </div>
 {aiError && (
 <p className="mt-3 text-sm text-semantic-error">{aiError}</p>
 )}
 {aiAnswer && (
 <div className="mt-5 border-t border-border-subtle pt-5">
 <div className="bg-surface-raised border border-border-subtle rounded-md p-5">
 <div className="flex items-center justify-between mb-2">
 <div className="flex items-center gap-2 text-xs text-ink-muted">
 <Sparkles className="w-3 h-3" />
 Resposta baseada em {aiAnswer.consulted} decisão(ões)
 </div>
 {aiAnswer.searchHistoryId && (
 <div className="flex items-center gap-1">
 <button
 onClick={() => submitAiFeedback(1)}
 className={`inline-flex items-center p-1.5 rounded transition-all ${
 aiFeedback === 1
 ? 'text-ink-secondary bg-surface-raised'
 : 'text-ink-muted hover:text-ink-secondary hover:bg-surface-raised'
 }`}
 aria-label="Resposta útil"
 aria-pressed={aiFeedback === 1}
 title="Resposta útil"
 >
 <ThumbsUp className="w-4 h-4" />
 </button>
 <button
 onClick={() => submitAiFeedback(-1)}
 className={`inline-flex items-center p-1.5 rounded transition-all ${
 aiFeedback === -1
 ? 'text-semantic-error bg-surface-raised'
 : 'text-ink-muted hover:text-semantic-error hover:bg-surface-raised'
 }`}
 aria-label="Resposta não ajudou"
 aria-pressed={aiFeedback === -1}
 title="Resposta não ajudou"
 >
 <ThumbsDown className="w-4 h-4" />
 </button>
 </div>
 )}
 </div>
 <div className="whitespace-pre-wrap text-sm text-ink-primary leading-relaxed">
 {aiAnswer.answer}
 </div>
 </div>
 {aiAnswer.sources.length > 0 && (
 <div className="mt-4">
 <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wide mb-2">
 Fontes consultadas
 </h3>
 <ul className="space-y-1.5">
 {aiAnswer.sources.map(src => (
 <li key={src.id} className="text-sm">
 <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium mr-2 ${tribunalBadgeColor(src.tribunalCode)}`}>
 {src.tribunalCode}
 </span>
 <span className="text-ink-secondary">
 {src.decisionType} {src.decisionNumber} — {src.title}
 </span>
 {src.url && (
 <Link
 href={src.url}
 target="_blank"
 rel="noopener noreferrer"
 className="inline-flex items-center gap-1 text-brand-600 hover:text-ink-primary ml-2"
 >
 <ExternalLink className="w-3 h-3" />
 </Link>
 )}
 </li>
 ))}
 </ul>
 </div>
 )}
 </div>
 )}
 </section>

 {/* Layout: filters + list */}
 <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
 {/* Filters panel */}
 <aside className={`bg-surface-page rounded-md border border-border-subtle p-5 lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto ${showFilters ? 'block' : 'hidden lg:block'}`}>
 <div className="flex items-center justify-between mb-4">
 <h2 className="font-bold text-ink-primary inline-flex items-center gap-2">
 <Filter className="w-4 h-4" /> Filtros
 </h2>
 {hasActiveFilters && (
 <button
 onClick={clearFilters}
 className="text-xs text-ink-muted hover:text-ink-secondary inline-flex items-center gap-1"
 >
 <X className="w-3 h-3" /> Limpar
 </button>
 )}
 </div>

 <div className="space-y-4">
 <div>
 <label className="block text-xs font-medium text-ink-secondary mb-1.5">Busca textual</label>
 <div className="relative">
 <Search className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2" />
 <input
 type="search"
 value={filters.q}
 onChange={e => handleFilterChange('q', e.target.value)}
 placeholder="Palavra-chave"
 className="w-full pl-9 pr-3 py-2 text-sm rounded-[3px] border border-border-strong focus:ring-2 focus:ring-amber-accent focus:border-brand-600 outline-none"
 />
 </div>
 </div>

 <div>
 <label className="block text-xs font-medium text-ink-secondary mb-1.5">Tribunal</label>
 <select
 value={filters.tribunal}
 onChange={e => handleFilterChange('tribunal', e.target.value)}
 className="w-full px-3 py-2 text-sm rounded-[3px] border border-border-strong focus:ring-2 focus:ring-amber-accent focus:border-brand-600 outline-none"
 >
 <option value="">Todos</option>
 {TRIBUNAIS.map(t => (
 <option key={t.code} value={t.code}>{t.label}</option>
 ))}
 </select>
 </div>

 <div>
 <label className="block text-xs font-medium text-ink-secondary mb-1.5">Ano</label>
 <select
 value={filters.ano}
 onChange={e => handleFilterChange('ano', e.target.value)}
 className="w-full px-3 py-2 text-sm rounded-[3px] border border-border-strong focus:ring-2 focus:ring-amber-accent focus:border-brand-600 outline-none"
 >
 <option value="">Qualquer</option>
 {years.map(y => (
 <option key={y} value={y}>{y}</option>
 ))}
 </select>
 </div>

 <div>
 <label className="block text-xs font-medium text-ink-secondary mb-1.5">Tipo de decisão</label>
 <select
 value={filters.decisionType}
 onChange={e => handleFilterChange('decisionType', e.target.value)}
 className="w-full px-3 py-2 text-sm rounded-[3px] border border-border-strong focus:ring-2 focus:ring-amber-accent focus:border-brand-600 outline-none"
 >
 <option value="">Todos</option>
 {TIPOS_DECISAO.map(t => (
 <option key={t.code} value={t.code}>{t.label}</option>
 ))}
 </select>
 </div>

 <div>
 <label className="block text-xs font-medium text-ink-secondary mb-1.5">Tema</label>
 <input
 type="text"
 value={filters.tema}
 onChange={e => handleFilterChange('tema', e.target.value)}
 placeholder="Ex.: pregão eletrônico"
 className="w-full px-3 py-2 text-sm rounded-[3px] border border-border-strong focus:ring-2 focus:ring-amber-accent focus:border-brand-600 outline-none"
 />
 <div className="flex flex-wrap gap-1 mt-2">
 {TEMAS_SUGERIDOS.map(t => (
 <button
 key={t}
 type="button"
 onClick={() => handleFilterChange('tema', t)}
 className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
 filters.tema === t
 ? 'bg-surface-deep border-border-strong text-ink-primary'
 : 'bg-surface-raised border-border-subtle text-ink-secondary hover:bg-surface-deep'
 }`}
 >
 {t}
 </button>
 ))}
 </div>
 </div>

 <div>
 <label className="block text-xs font-medium text-ink-secondary mb-1.5">
 Artigo da Lei 14.133
 </label>
 <input
 type="text"
 value={filters.artigo}
 onChange={e => handleFilterChange('artigo', e.target.value)}
 placeholder="Ex.: 18 ou art. 75"
 className="w-full px-3 py-2 text-sm rounded-[3px] border border-border-strong focus:ring-2 focus:ring-amber-accent focus:border-brand-600 outline-none"
 />
 </div>
 </div>
 </aside>

 {/* Results */}
 <div>
 <div className="flex items-center justify-between mb-4">
 <div className="text-sm text-ink-secondary">
 {loadingList ? (
 <span className="inline-flex items-center gap-2">
 <Loader2 className="w-4 h-4 animate-spin" /> Buscando...
 </span>
 ) : list ? (
 <span>
 <strong>{list.total}</strong> decisão(ões) encontrada(s)
 {hasActiveFilters && ' com os filtros ativos'}
 </span>
 ) : null}
 </div>
 <button
 onClick={() => setShowFilters(v => !v)}
 className="lg:hidden text-sm text-ink-secondary font-medium inline-flex items-center gap-1"
 >
 <Filter className="w-4 h-4" />
 {showFilters ? 'Ocultar' : 'Mostrar'} filtros
 </button>
 </div>

 {listError && (
 <div className="rounded-[3px] bg-surface-raised border border-border-subtle p-4 text-sm text-semantic-error mb-4">
 {listError}
 </div>
 )}

 <div className="space-y-3">
 {list?.items.map(item => {
 const themes = parseJsonArray(item.themes);
 const articles = parseJsonArray(item.leiArticles);
 const dateStr = item.dataJulgamento
 ? new Date(item.dataJulgamento).toLocaleDateString('pt-BR')
 : null;
 return (
 <article
 key={item.id}
 className="bg-surface-page rounded-md border border-border-subtle p-5 transition-shadow"
 >
 <div className="flex flex-wrap items-center gap-2 mb-2">
 <span className={`px-2 py-0.5 rounded text-xs font-semibold ${tribunalBadgeColor(item.tribunalCode)}`}>
 {item.tribunalCode}
 </span>
 <span className="text-xs text-ink-muted">
 {item.decisionType} {item.decisionNumber}
 </span>
 {dateStr && (
 <span className="text-xs text-ink-muted">· {dateStr}</span>
 )}
 {item.relator && (
 <span className="text-xs text-ink-muted">· Rel. {item.relator}</span>
 )}
 </div>
 <h3 className="font-semibold text-ink-primary mb-2 leading-snug">{item.title}</h3>
 <p className="text-sm text-ink-secondary leading-relaxed">{item.ementa}</p>
 {item.summary && (
 <div className="mt-3 p-3 bg-surface-raised/60 border border-border-subtle rounded-[3px]">
 <div className="flex items-center gap-1.5 text-xs text-amber-accent-deep font-semibold mb-1">
 <Sparkles className="w-3 h-3" /> Resumo IA
 </div>
 <p className="text-sm text-ink-secondary">{item.summary}</p>
 </div>
 )}
 {(themes.length > 0 || articles.length > 0) && (
 <div className="flex flex-wrap gap-1.5 mt-3">
 {themes.slice(0, 5).map(t => (
 <span key={`t-${t}`} className="text-xs px-2 py-0.5 bg-surface-raised text-ink-secondary rounded-full">
 {t}
 </span>
 ))}
 {articles.slice(0, 5).map(a => (
 <span key={`a-${a}`} className="text-xs px-2 py-0.5 bg-surface-raised text-brand-700 rounded-full inline-flex items-center gap-1">
 <BookOpen className="w-3 h-3" /> art. {a}
 </span>
 ))}
 </div>
 )}
 {item.url && (
 <div className="mt-3">
 <Link
 href={item.url}
 target="_blank"
 rel="noopener noreferrer"
 className="text-sm text-brand-600 hover:text-ink-primary inline-flex items-center gap-1"
 >
 Abrir decisão original <ExternalLink className="w-3 h-3" />
 </Link>
 </div>
 )}
 </article>
 );
 })}

 {!loadingList && list && list.items.length === 0 && (
 <div className="bg-surface-page rounded-md border border-border-subtle p-8 text-center">
 <Gavel className="w-10 h-10 text-border-strong mx-auto mb-3" />
 <p className="text-ink-secondary">Nenhuma decisão encontrada com os filtros atuais.</p>
 {hasActiveFilters && (
 <button
 onClick={clearFilters}
 className="mt-3 text-sm text-ink-secondary font-medium hover:text-ink-primary"
 >
 Limpar filtros
 </button>
 )}
 </div>
 )}
 </div>

 {/* Pagination */}
 {list && list.totalPages > 1 && (
 <div className="flex items-center justify-between mt-6">
 <button
 onClick={() => setPage(p => Math.max(1, p - 1))}
 disabled={page <= 1 || loadingList}
 className="px-4 py-2 text-sm rounded-[3px] border border-border-strong bg-surface-page hover:bg-surface-raised disabled:opacity-50 disabled:cursor-not-allowed"
 >
 Anterior
 </button>
 <span className="text-sm text-ink-secondary">
 Página {list.page} de {list.totalPages}
 </span>
 <button
 onClick={() => setPage(p => Math.min(list.totalPages, p + 1))}
 disabled={page >= list.totalPages || loadingList}
 className="px-4 py-2 text-sm rounded-[3px] border border-border-strong bg-surface-page hover:bg-surface-raised disabled:opacity-50 disabled:cursor-not-allowed"
 >
 Próxima
 </button>
 </div>
 )}
 </div>
 </div>
 </div>
 </div>
 );
}
