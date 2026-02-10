import { courses } from '@/data/courses';
import type { Course } from '@/lib/types';

export function getCourseById(id: string): Course | null {
  return courses.find(c => c.id === id) || null;
}

export function getCourseBySlug(slug: string): Course | null {
  return courses.find(c => c.slug === slug) || null;
}

export function getAllCourses(): Course[] {
  return courses;
}

export function getSlugFromId(id: string): string | undefined {
  return courses.find(c => c.id === id)?.slug;
}

export function getIdFromSlug(slug: string): string | undefined {
  return courses.find(c => c.slug === slug)?.id;
}
