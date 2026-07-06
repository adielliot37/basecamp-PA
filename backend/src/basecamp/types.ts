export interface BcPerson {
  id: number;
  name: string;
  email_address?: string;
}

export interface BcNotification {
  id: number;
  type: string; // "Mention", "Reminder", "Assignment", etc.
  title: string;
  content_excerpt?: string;
  app_url: string;
  bucket_name: string;
  created_at: string;
  read_at: string | null;
  section: string;
}

export interface BcNotificationsResponse {
  reads: BcNotification[];
  unreads?: BcNotification[];
}

export interface BcAssignmentTodo {
  id: number;
  title: string;
  app_url: string;
  due_on: string | null;
  completed: boolean;
  bucket: { id: number; name: string; type: string };
  created_at: string;
  updated_at: string;
}

export interface BcComment {
  id: number;
  content: string;
  created_at: string;
  updated_at: string;
  creator: BcPerson;
  app_url: string;
  bucket: { id: number; name: string; type: string };
  parent?: { id: number; title?: string; type: string; url: string; app_url: string };
}

export interface BcRecording {
  id: number;
  title: string;
  type: string;
  app_url: string;
  bucket: { id: number; name: string; type: string };
  created_at: string;
  updated_at: string;
  creator: BcPerson;
}

export interface BcProject {
  id: number;
  name: string;
  status: string;
}
