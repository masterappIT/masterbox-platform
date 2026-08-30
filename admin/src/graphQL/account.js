import { gql } from '@apollo/client';

export const LIST_ACCOUNTS = gql`
  query ListAccounts($input: AccountListInput) {
    listAccounts(input: $input) {
      items {
        _id
        email
        role
        company_id
        info { name avatar mobile }
      }
      total
    }
  }
`;

export const CREATE_ACCOUNT = gql`
  mutation CreateAccount($input: AccountCreateInput!, $company_id: String!) {
    createAccount(input: $input, company_id: $company_id) {
      _id email role company_id info { name avatar mobile }
    }
  }
`;

export const UPDATE_ACCOUNT = gql`
  mutation UpdateAccount($_id: String!, $input: AccountUpdateInput!) {
    updateAccount(_id: $_id, input: $input) {
      _id email role company_id info { name avatar mobile }
    }
  }
`;

export const DELETE_ACCOUNT = gql`
  mutation DeleteAccount($_id: String!) {
    deleteAccount(_id: $_id)
  }
`;
// query FindAccountByEmail($email: String) {
//   findAccountByEmail(email: $email) {
//     _id
//     email
//     token
//     info {
//       name
//       avatar
//       mobile
//     }
//     company_id
//   }
// }
// `;



export const LOGIN = gql`
mutation Mutation( $email: String $password: String) {
  loginAccount(LoginInput: {email: $email, password: $password}) {
    token
    refreshToken
    email
    _id
    company_id
    role
    info {
      name
      avatar
      mobile
    }
  }
}
`

export const REFRESH_TOKEN = gql`
mutation LoginAccount($refreshToken:String! $account_id:String! $company_id: String!) {
  refreshToken(refreshTokenInput: {refreshToken:$refreshToken, company_id:$company_id, account_id:$account_id}) {
    refreshToken
    token
  }
}

`;

// 註冊在此
export const REGISTER_ACCOUNT = gql`
mutation REGISTER_ACCOUNT($company_id: String! $email: String! $password:String!) {
  REGISTER_ACCOUNT(AccountRegisterInput:{company_id: $company_id, email: $email, password: $password}) {
    _id
    email
    company_id
    token
    info {
      name
      avatar
      mobile
    }
  }
}
 `;

// // 重新要token
// export const REFRESHTOKEN = gql`
// mutation Mutation($refreshTokenInput: refreshTokenInput) {
//   refreshToken(refreshTokenInput: $refreshTokenInput) {
//     refreshToken
//     token
//   }
// }
//  `;


