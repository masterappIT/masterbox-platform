import { gql, } from '@apollo/client';





// 註冊在此

export const REGISTERCOMPANY = gql`
mutation Mutation($chinese_name: String $english_name: String $email:String $country:String $mobile:String) {
  registerCompany(CompanyRegisterInput:{chinese_name: $chinese_name,english_name:$english_name,email:$email,country:$country,mobile:$mobile}) {
    _id
  }
}

`;

export const COMPANY = gql`

query Query($id: String) {
  findCompanyById(_id: $id) {
    _id
    email
    chinese_name
    english_name
    logo
    mobile
    subscription {
      name
      period {
        start
        end
      }
    }
    country
    pin_number
    address
  
    principal_info {
      first_name
      last_name
      cn_name
      mobile
    }
    labels
  }
}

`;



export const UPDATE_COMPANY_INFO = gql`
mutation UpdateCompanyInfo($updateCompanyInput: UpdateCompanyInfoInput) {
  updateCompanyInfo(UpdateCompanyInput: $updateCompanyInput) {
    chinese_name
    english_name
    logo
    mobile
    email
    country
    pin_number
    address
    principal_info {
      first_name
      last_name
      cn_name
      mobile
    }
    labels
    _id
    subscription {
      name
      period {
        start
        end
      }
    }
  }
}

`



// export const UPDATE_COMPANY_INFO = gql`

// mutation Mutation(  
//     $_id: String,
//    $email: String,
//    $chinese_name: String,
//    $english_name: String,
//    $logo: String,
//    $mobile: String,
    
      
//     $country: String,
//     $pin_number: String,
//     $address: String,
//      $principal_info_first_name: String,
//      $principal_info_last_name: String,
//      $principal_info_cn_name: String,
//      $principal_info_mobile: String
//   ) {
//   updateCompanyInfo(UpdateCompanyInput: { 
//    _id: $_id,
//   email: $email,
//   chinese_name: $chinese_name,
//   english_name: $english_name,
//   logo: $logo,
//   mobile: $mobile,
  
//    country: $country,
//    pin_number: $pin_number,
//    address: $address,
//    principal_info: {
//      first_name: $principal_info_first_name,
//      last_name: $principal_info_last_name,
//      cn_name: $principal_info_cn_name,
//      mobile: $principal_info_mobile
//     }
//   })

  
// }

// `



