export interface UserDigest {
  userId: string;
  newCount: number;
}

export interface PushTokenRow {
  id: string;
  expoToken: string;
}

export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
}

export interface ExpoPushTicket {
  status: 'ok' | 'error';
  id?: string;
  details?: { error?: string };
}

export type PushSender = (messages: ExpoPushMessage[]) => Promise<ExpoPushTicket[]>;

export interface NotifyDb {
  /** Users with at least one summary that became 'done' today, with the count. */
  listUserDigests(): Promise<UserDigest[]>;
  listPushTokens(userId: string): Promise<PushTokenRow[]>;
  deletePushTokens(ids: string[]): Promise<void>;
}

export interface NotifyDeps {
  db: NotifyDb;
  send: PushSender;
}
