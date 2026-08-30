import { gql } from '@apollo/client';

export const MESSAGE_TEMPLATES = gql`
  query MessageTemplates { messageTemplates { id name category platform contents createdAt updatedAt } }
`;
export const CREATE_MESSAGE_TEMPLATE = gql`
  mutation CreateMessageTemplate($input: MessageTemplateInput!) { createMessageTemplate(input: $input) { id name category platform contents createdAt updatedAt } }
`;
export const DELETE_MESSAGE_TEMPLATE = gql`
  mutation DeleteMessageTemplate($id: ID!) { deleteMessageTemplate(id: $id) }
`;
