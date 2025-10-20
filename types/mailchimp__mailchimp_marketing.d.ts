declare module '@mailchimp/mailchimp_marketing' {

  interface SetConfigOptions {
    apiKey?: string;
    accessToken?: string;
    server?: string;
  }

  interface TagInfo {
    name: string;
    status: 'active' | 'inactive';
  }

  interface MemberInfo {
    email_address: string;
    status?: 'subscribed' | 'unsubscribed' | 'cleaned' | 'pending';
    status_if_new?: 'subscribed' | 'unsubscribed' | 'cleaned' | 'pending';
    merge_fields?: Record<string, string | number | boolean>;
    interests?: Record<string, boolean>;
    tags?: TagInfo[];
  }

  interface BatchMemberInfo extends MemberInfo {
    email_address: string;
  }

  interface BatchOperation {
    members: BatchMemberInfo[];
    update_existing?: boolean;
  }

  interface Campaign {
    id: string;
    web_id: number;
    type: string;
    create_time: string;
    archive_url: string;
    status: string;
  }

  interface CampaignCreationOptions {
    type: 'regular' | 'plaintext' | 'absplit' | 'rss' | 'variate';
    recipients: {
      list_id: string;
      segment_opts?: Record<string, unknown>;
    };
    settings: {
      subject_line: string;
      preview_text?: string;
      title?: string;
      from_name?: string;
      reply_to?: string;
      auto_footer?: boolean;
      inline_css?: boolean;
    };
  }

  interface CampaignContent {
    html?: string;
    plain_text?: string;
    template?: {
      id: number;
      sections?: Record<string, string | number | boolean>;
    };
  }

  interface MailchimpClient {
    setConfig(options: SetConfigOptions): void;

    lists: {
      getListMembersInfo(listId: string, opts?: Record<string, unknown>): Promise<Record<string, unknown>>;
      getListMember(listId: string, subscriberHash: string, opts?: Record<string, unknown>): Promise<Record<string, unknown>>;
      addListMember(listId: string, body: MemberInfo): Promise<Record<string, unknown>>;
      updateListMember(listId: string, subscriberHash: string, body: Partial<MemberInfo>): Promise<Record<string, unknown>>;
      updateListMemberTags(listId: string, subscriberHash: string, body: { tags: TagInfo[] }): Promise<Record<string, unknown>>;
      setListMember(listId: string, subscriberHash: string, body: MemberInfo): Promise<Record<string, unknown>>;
      batchListMembers(listId: string, body: BatchOperation): Promise<Record<string, unknown>>;
    };

    campaigns: {
      create(campaign: CampaignCreationOptions): Promise<Campaign>;
      setContent(campaignId: string, content: CampaignContent): Promise<Record<string, unknown>>;
      send(campaignId: string): Promise<Record<string, unknown>>;
      list(opts?: Record<string, unknown>): Promise<Record<string, unknown>>;
    };
  }

  const mailchimp: MailchimpClient;
  export default mailchimp;
}
