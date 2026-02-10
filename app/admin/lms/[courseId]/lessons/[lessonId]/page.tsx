import LessonEditorClient from './LessonEditorClient';

export default async function LessonEditorPage({ params }: { params: Promise<{ courseId: string; lessonId: string }> }) {
  const { courseId, lessonId } = await params;
  return <LessonEditorClient courseId={courseId} lessonId={lessonId} />;
}
