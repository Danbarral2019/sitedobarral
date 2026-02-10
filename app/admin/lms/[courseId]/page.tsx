import ModuleManagerClient from './ModuleManagerClient';

export default async function ModuleManagerPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  return <ModuleManagerClient courseId={courseId} />;
}
