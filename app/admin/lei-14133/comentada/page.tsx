import { Metadata } from 'next';
import ComentadaAdminClient from './ComentadaAdminClient';

export const metadata: Metadata = {
  title: 'Lei 14.133 Comentada — Admin Editorial',
};

export default function Page() {
  return <ComentadaAdminClient />;
}
