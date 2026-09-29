import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Lei 14.133/2021 (prévia)',
};

export default function Lei14133PreviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
