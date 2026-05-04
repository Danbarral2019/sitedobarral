import { Metadata } from 'next';
import TcuHubClient from './TcuHubClient';

export const metadata: Metadata = {
  title: 'Hub TCU — Admin',
};

export default function Page() {
  return <TcuHubClient />;
}
