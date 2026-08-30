import request from "request";

export const masterBox_meta_Route = async({endPoints='', method='',queryStrings={}, headers, payloads={}, formData={}}) => {
    return new Promise((resolve, reject) => {
        request({
            "uri": `${process.env.BASE_URL}/meta/${endPoints}`,
            "method": method,
            "headers": headers,
            ...(Object.keys(queryStrings).length > 0 && {"qs": queryStrings}),
            ...(Object.keys(payloads).length > 0 && {"json": payloads}),
            ...(Object.keys(formData).length > 0 && {"formData": formData})
        }, (err, _res, _body) => {
            if(!err){
                // console.log('result:', _res.body)
                resolve(_res.body)
            }else{
                console.log('masterBox_meta_error', err)
                reject(err)
            }
        })        
    }).catch((err) => {
        console.log('masterBox_meta_error', err)
        reject(err)
    })
}

export const masterBox_Api_graphql = ({endPoints='', method='',queryStrings='', body =''}) => {
    // console.log(body)

    return new Promise((resolve, reject) => {
        request({
            "uri": `${process.env.BASE_URL}/graphql?${endPoints}`,
            "method": method,
            "headers": {
                "Content-Type": "application/json"
            },
            ...(Object.keys(queryStrings).length > 0 && {"qs": queryStrings}),
            ...(body.length > 0  && {"body": body}),
        }, (err, _res, _body) => {
            if(!err){
                console.log('result:', _res.body)
                resolve(_res.body)
            }else{
                reject(err)
            }
        })        
    })
}