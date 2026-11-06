import { gql } from 'apollo-server-express';

export default gql`
  type MessageTemplate {
    id: ID!
    name: String!
    category: String!
    platform: String!
    contents: String!
    createdAt: DateTime!
    updatedAt: DateTime!
  }
  input MessageTemplateInput {
    name: String!
    category: String
    platform: String!
    contents: String!
  }
  extend type Query {
    messageTemplates: [MessageTemplate!]!
    "The company's templates, for any agent to insert into a reply."
    quickReplies: [MessageTemplate!]!
  }
  extend type Mutation {
    createMessageTemplate(input: MessageTemplateInput!): MessageTemplate!
    updateMessageTemplate(id: ID!, input: MessageTemplateInput!): MessageTemplate!
    deleteMessageTemplate(id: ID!): Boolean!
  }
`;
