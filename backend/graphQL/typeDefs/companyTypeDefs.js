import { gql } from 'apollo-server-express';

export default gql`

scalar DateTime
scalar ObjectId


type period {
    start: DateTime,
    end: DateTime
}

input periodInput {
    start: String,
    end: String
}

type companySubscription {
        name: String,
        period: period,
}
input companySubscriptionInput {
        name: String,
        period: periodInput,
}

type channel {
    platform:String,
    name: String,
    access_info: String,
    info: String,

}
input channelInput {
    platform:String,
    name: String,
    access_info: String,
    info: String,

}

type principalInfo{ 
    first_name:  String,
        last_name:  String,
        cn_name:  String,
        mobile:  String
}
input principalInfoInput{ 
    first_name:  String,
        last_name:  String,
        cn_name:  String,
        mobile:  String
}

input UpdateCompanyInfoInput{

    _id: String,

    email: String

    chinese_name: String

    english_name: String

    logo: String

    mobile: String,

    subscription: companySubscriptionInput,

    country: String,

    pin_number:String,

    address: String,
  
    principal_info: principalInfoInput,
    
}



type Company {

_id: String

email: String

chinese_name: String

english_name: String

logo: String

mobile: String,

subscription: companySubscription,

country: String,

pin_number:String,

address: String,

channels: [channel],

principal_info: principalInfo,

labels: [String], 

}

input CompanyRegisterInput{
    chinese_name: String
    english_name: String
    email:String
    country:String
    mobile: String
}


type Channel{
    platform:String!
    name: String! 
    access_info: String!
    info: String!
}


input ChannelInput{
    company_id: String!
    platform: String!

}



type Query {
    findCompanyById(_id:String): Company,
    findCompanyByEmail(email:String): Company

}

type Mutation {
    registerCompany(CompanyRegisterInput: CompanyRegisterInput):Company
    registerChannel(ChannelInput: ChannelInput):Channel
    updateCompanyInfo(UpdateCompanyInput:UpdateCompanyInfoInput): String
}

`