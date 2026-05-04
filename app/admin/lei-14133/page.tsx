import { Metadata } from 'next';
import Lei14133HubClient from './Lei14133HubClient';

export const metadata: Metadata = {
  title: 'Lei 14.133 — Admin',
};

export default function Page() {
  return <Lei14133HubClient />;
}
