import QuizEditorClient from './QuizEditorClient';

export default async function QuizPage({
  params,
}: {
  params: Promise<{ courseId: string; lessonId: string }>;
}) {
  const { courseId, lessonId } = await params;
  return <QuizEditorClient courseId={courseId} lessonId={lessonId} />;
}
