export interface IDocument {
  name?: string;
  document_id: string;
  apartment_id: string;
  template_name: string;
  template_fields: Record<string, string>;
  created_at: string;
  updated_at: string;
}

export interface IDocumentsState {
  documents: IDocument[];
  loading: boolean;
  error: string | null;
  selectedDocument: IDocument | null;
}
