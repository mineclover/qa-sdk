export interface Service {
  service_id: string;
  service_name: string;
  display_name: string;
  description: string | null;
  status: string;
  created_at: Date;
  updated_at: Date;
}
