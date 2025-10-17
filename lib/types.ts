export interface Course {
  id: string;
  slug: string;
  title: string;
  description: string;
  shortDescription: string;
  duration?: string;
  bibliography: string[];
  publicDocuments: Document[];
  restrictedDocuments: Document[];
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Document {
  id: string;
  title: string;
  description?: string;
  type: 'pdf' | 'doc' | 'link' | 'video';
  url: string;
  category: 'apostila' | 'acordao' | 'parecer' | 'edital' | 'artigo' | 'outro';
  courseId: string;
  isPublic: boolean;
  tags: string[];
  uploadedAt: Date;
  size?: number;
}

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  author: string;
  publishedAt: Date;
  updatedAt: Date;
  tags: string[];
  featuredImage?: string;
  isPublished: boolean;
}

export interface QRCodeAccess {
  id: string;
  code: string;
  courseId: string;
  courseName: string;
  turma: string;
  validFrom: Date;
  validUntil: Date;
  isActive: boolean;
  maxUses?: number;
  currentUses: number;
  createdAt: Date;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'student';
  qrCodeAccess?: QRCodeAccess[];
  createdAt: Date;
  lastAccess?: Date;
}

export interface NewsletterSubscriber {
  id: string;
  email: string;
  name: string;
  interests: string[];
  isActive: boolean;
  subscribedAt: Date;
  unsubscribedAt?: Date;
}

export interface ContactForm {
  name: string;
  email: string;
  phone?: string;
  courseInterest?: string;
  message: string;
}

export interface SearchFilters {
  query?: string;
  category?: string;
  courseId?: string;
  tags?: string[];
  dateFrom?: Date;
  dateTo?: Date;
}