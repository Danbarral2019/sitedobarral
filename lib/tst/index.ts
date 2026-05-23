export type {
  TstSumulaParsed,
  TstSumulaItem,
  TstSumulaIrr,
  TstSumulaResolucao,
  TstSumulaSituacao,
} from './types';
export { parseTstSumulas, parseSumulaBlock, splitIntoSumulaBlocks } from './parser';
export { extractTstPdf } from './extract-pdf';
