'use client';

import { useState } from 'react';
import { useServerInsertedHTML } from 'next/navigation';
import { StyleRegistry, createStyleRegistry } from 'styled-jsx';

/**
 * Registro do styled-jsx para o App Router.
 *
 * Sem ele, os estilos de `<style jsx>` (MarkdownContent, LessonMarkdownContent,
 * QuickAccessBar, lei comentada) não vêm no HTML do servidor e só entram após a
 * hidratação: até lá o texto aparece sem formatação e os blocos de código do
 * blog transbordam a página no celular. O registro coleta os estilos durante a
 * renderização no servidor e os injeta no <head>.
 */
export default function StyledJsxRegistry({ children }: { children: React.ReactNode }) {
  const [jsxStyleRegistry] = useState(() => createStyleRegistry());

  useServerInsertedHTML(() => {
    const styles = jsxStyleRegistry.styles();
    jsxStyleRegistry.flush();
    return <>{styles}</>;
  });

  return <StyleRegistry registry={jsxStyleRegistry}>{children}</StyleRegistry>;
}
