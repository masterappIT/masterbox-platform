import { gql, } from '@apollo/client';

// What the admin shows of a message. `cursor` places it in its conversation for paging and catching up.
export const MESSAGE_FIELDS = `
    _id
    contents
    platform
    channel_id
    to_chat_room_id
    sentAt
    inbound
    isMine
    delivery_error
    preview
    cursor
`;

// 送出訊息
export const SEND_MESSAGE = gql`
mutation SendMessage($messageInput: MessageInput) {
  appSendMessage(MessageInput: $messageInput) {
    ${MESSAGE_FIELDS}
  }
}
`;

// The approved templates of a WhatsApp conversation's number, read from Meta.
export const WHATSAPP_TEMPLATES = gql`
query WhatsappTemplates($id: ID!) {
  whatsappTemplates(id: $id) {
    id
    name
    language
    category
    header_format
    header_text
    body_text
    footer_text
    buttons {
      type
      text
      url
      phone_number
    }
    variables {
      key
      component
      name
      label
      example
    }
    supported
    unsupported_reason
  }
}
`;

export const SEND_WHATSAPP_TEMPLATE = gql`
mutation SendWhatsappTemplate($id: ID!, $templateId: ID!, $values: [WhatsappTemplateValue!], $headerMediaUrl: String) {
  sendWhatsappTemplate(id: $id, templateId: $templateId, values: $values, header_media_url: $headerMediaUrl) {
    ${MESSAGE_FIELDS}
  }
}
`;

// A page of a conversation: the newest messages, older ones with before, or newer ones with after.
export const MESSAGE_PAGE = gql`
query MessagePage($id: ID!, $first: Int, $before: String, $after: String) {
  messagePage(id: $id, first: $first, before: $before, after: $after) {
    messages {
      ${MESSAGE_FIELDS}
    }
    hasOlder
    hasNewer
  }
}
`;
