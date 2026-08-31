import { gql } from 'apollo-server-express';
import { AuthenticationError } from 'apollo-server-express';

export default gql`

  type Subscription {
    numberIncremented: Int
  }
 

type AccountInfo  {
        name: String
        avatar: String
        mobile: Int
}

type Account{
    _id: String
    email:String
    company_id: String
    role: String
    permissions: String
    info: AccountInfo
    token: String
    refreshToken: String
}

type AccountList {
    items: [Account!]!
    total: Int!
}

  input AccountRegisterInput{
      email:String!
      password:String!
      company_id:String!
      role: String
      permissions: [String]
  }

  input AccountCreateInput {
      email: String!
      password: String!
      role: String
      permissions: [String]
      user_info: String
  }

  input AccountUpdateInput {
      email: String
      password: String
      role: String
      permissions: [String]
      user_info: String
  }

  input AccountListInput {
      company_id: String
  }

input LoginInput{
    email:String
    password:String
}

input RefreshTokenInput {
    refreshToken: String!
    account_id: String!
    company_id: String!
}


type Query {
    findAccountByEmail(email:String): Account ,
    findAccountByCompanyId(company_id:String): Account
    listAccounts(input: AccountListInput): AccountList!
    currentNumber: Int
}

 type Mutation {
     registerAccount(AccountRegisterInput: AccountRegisterInput):Account
     createAccount(input: AccountCreateInput!, company_id: String!): Account!
     updateAccount(_id: String!, input: AccountUpdateInput!): Account!
     deleteAccount(_id: String!): Boolean!
     loginAccount(LoginInput:LoginInput):Account
     refreshToken(refreshTokenInput: RefreshTokenInput!): Account!
     insertSubscribeChannelsToAccount(channels:[String]): Account
 }

`
