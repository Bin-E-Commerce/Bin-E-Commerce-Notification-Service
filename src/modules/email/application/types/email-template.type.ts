export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export interface EmailBrandOptions {
  logoCid?: string;
  webBaseUrl: string;
}
