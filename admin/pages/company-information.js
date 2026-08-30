/* eslint-disable no-unused-expressions */
import Input from "../src/stories/components/Input";
import React, { useState, useEffect, useMemo } from "react";
import { useDispatch } from "react-redux";
import { saveCompanyInfo } from "../src/redux/slices/companySlices";
import { updateCompanyInfo, fetchCompanyInfo } from '../src/redux/slices/companySlices';
import validator from 'validator';
import errorHandler, { type } from '../src/utils/errorHandler';
import PhoneInput from 'react-phone-input-2'
import 'react-phone-input-2/lib/style.css'

import PhoneSelector from '../src/components/Auth/PhoneSelector';

//components

import { useSelector } from "react-redux";
import { selectCompanyInfo } from '../src/redux/slices/companySlices';
import Card from "../src/stories/components/Card";
import Headline from "../src/stories/components/Headline";
import Button from "../src/stories/components/Button";
import Form from "../src/stories/components/Form";
import { data } from "autoprefixer";
import Selector from "../src/stories/components/Selector";
import Dropdown from "../src/stories/components/Dropdown";
import Checkbox from "../src/stories/components/Checkbox";
import Radio from "../src/stories/components/Radio";
import { keyValueGenerator, initFormData } from "../src/utils/utils";
import { selectUserToken } from '../src/redux/slices/userSlices';

import { useTranslation } from 'react-i18next';


let dataStructure = {
    basic: ['chinese_name', "english_name", 'email', 'mobile', 'pin_number', 'address','BR'],
    principal_info: ['cn_name', 'mobile','first_name', 'last_name' ],
    subscription: ['plan', 'period'],
}

// const updateCompanyInfoData = {
//     _id: null,
//     email: null,
//     chinese_name: null,
//     english_name: null,
//     logo: null,
//     mobile: null,
//     subscription_name: null,
//     subscription_period_start: null,
//     subscription_period_end: null,
//     country: null,
//     pin_number: null,
//     address: null,
//     principal_info_first_name: null,
//     principal_info_last_name: null,
//     principal_info_cn_name: null,
//     principal_info_mobile: null
// }

const inputDataGenerator = (data = {}) => {

    const inputData = [];

    Object.keys(dataStructure).forEach(key => {
        const dataSets = { title: key, children: [] }

        if (data[key]) {
            dataStructure[key].forEach((childKey, i) => {

                dataSets.children.push({ name: childKey, value: data[key][childKey] || "" })

            })
            console.log('dataSets',dataSets)
        }

        inputData.push(dataSets)
    })

    console.log('inputData', inputData)
    return inputData

}

export default function CompanyInformationPage() {
    const { t } = useTranslation();

    const dispatch = useDispatch();
    // 抓原始資料
    const companyInfo = useSelector(selectCompanyInfo)
    const token = useSelector(selectUserToken)
    // 要倒出來的迴圈型態
    // const [companyInfoDefault, setCompanyInfoDefault] = useState(keyValueGenerator(null, showData, companyInfo))
    // 所有inputsData
    const [inputsData, setInputsData] = useState([])
    const [inputsError, setInputsError] = useState(null)
    const [isSaving, setIsSaving] = useState(false)
    const isLoaded = inputsData.length === Object.keys(dataStructure).length &&
        Object.keys(companyInfo?.basic || {}).length > 0 &&
        Object.keys(companyInfo?.principal_info || {}).length > 0 &&
        Object.keys(companyInfo?.subscription || {}).length > 0

    const cancelClick = () => {
        if (!isLoaded || isSaving) return
        setInputsData(inputDataGenerator(companyInfo));
        setInputsError(null)
    }

    const isChinese = (data) => {
        let ret = true;
        for (var i = 0; i < data.length; i++)
            ret = ret && (data.charCodeAt(i) >= 10000);
        return ret;
    }

    const checkInputsData = () => {
        if (!isLoaded) return false

        let errorMessages = {
            basic: {},
            principal_info: {},
            subscription: {}
        }

        const getValue = (section, name) => inputsData.find(({ title }) => title === section)
            ?.children.find((child) => child.name === name)?.value || ''
        let chinese_name = getValue('basic', 'chinese_name')
        let english_name = getValue('basic', 'english_name')
        let email = getValue('basic', 'email')
        let mobile = getValue('basic', 'mobile')
        let pin_number = getValue('basic', 'pin_number')
        let principal_first_name = getValue('principal_info', 'first_name')
        let principal_last_name = getValue('principal_info', 'last_name')
        let principal_cn_name = getValue('principal_info', 'cn_name')
        let principal_mobile = getValue('principal_info', 'mobile')

        var regEn = /^[a-zA-Z]*$/;
        var regNum = /^[0-9]*$/;
        if (!isChinese(chinese_name) || chinese_name === '') errorMessages['basic']['chinese_name'] = new errorHandler(type.INVALID_FORMAT, 'chinese_name').createErrorMessage()
        if (!regEn.test(english_name) || english_name === '') errorMessages['basic']['english_name'] = new errorHandler(type.INVALID_FORMAT, 'english_name').createErrorMessage()
        if (!validator.isEmail(email) || email === '') errorMessages['basic']['email'] = new errorHandler(type.INVALID_FORMAT, 'email').createErrorMessage()
        if (!validator.isMobilePhone(mobile, ['zh-TW', 'zh-HK', 'zh-CN']) || mobile === '') errorMessages['basic']['mobile'] = new errorHandler(type.INVALID_FORMAT, 'mobile').createErrorMessage()
        if (!regNum.test(pin_number) || pin_number === '') errorMessages['basic']['pin_number'] = new errorHandler(type.INVALID_FORMAT, 'pin_number').createErrorMessage()


        if (!regEn.test(principal_first_name) || principal_first_name === '') errorMessages['principal_info']['first_name'] = new errorHandler(type.INVALID_FORMAT, 'first_name').createErrorMessage()
        if (!regEn.test(principal_last_name) || principal_last_name === '') errorMessages['principal_info']['last_name'] = new errorHandler(type.INVALID_FORMAT, 'last_name').createErrorMessage()

        if (!isChinese(principal_cn_name) || principal_cn_name === '') errorMessages['principal_info']['cn_name'] = new errorHandler(type.INVALID_FORMAT, 'cn_name').createErrorMessage()
        if (!validator.isMobilePhone(principal_mobile, ['zh-TW', 'zh-HK', 'zh-CN']) || principal_mobile === '') errorMessages['principal_info']['mobile'] = new errorHandler(type.INVALID_FORMAT, 'mobile').createErrorMessage()


        setInputsError(errorMessages);
        if (Object.keys(errorMessages.basic).length === 0 && Object.keys(errorMessages.principal_info).length === 0 && Object.keys(errorMessages.subscription).length === 0) { setInputsError(null); return true }

    }

    const saveClick = async () => {
        if (isSaving || !checkInputsData()) return;

        setIsSaving(true)
        let updatedData = {}

        inputsData.forEach(({ title, children }) => {
            const updatedChildren = children.filter(({ name, value }) => value !== companyInfo?.[title]?.[name])

            updatedChildren.forEach(({ name, value }) => {
                if (title === 'principal_info') {
                    updatedData.principal_info = { ...updatedData.principal_info, [name]: value }
                }
                else {
                    updatedData[name] = value
                }
            })
        })

        try {
            await dispatch(updateCompanyInfo(updatedData)).unwrap()
        } finally {
            setIsSaving(false)
        }
    }

    const onInputChange = (value, parentIndex, childIndex) => {

        const newInput = [...inputsData]
        newInput[parentIndex]['children'][childIndex].value = value
        setInputsData(newInput)

    }

    const onPhoneChange = (e , parentIndex, childIndex) => {
        console.log(e)
        
        const value = e

        const newInput = [...inputsData]
        newInput[parentIndex]['children'][childIndex].value = value
        setInputsData(newInput)

    }

    useEffect(() => {

        dispatch(fetchCompanyInfo())

    }, [])


    useEffect(() => {

        setInputsData(inputDataGenerator(companyInfo))

    }, [companyInfo])



    console.log('inputsError', inputsError ? true : false)

    if (!isLoaded) return null

    return (
        <Form customStyles='company-information'
            cancelClick={() => cancelClick()}
            saveClick={() => saveClick()}
        >
            {inputsData?.map(({ title, children }, i) => {

                return (
                    <Card key={i} rounded customStyles='p-[24px]'>
                        <Headline size='normal' title={t(title)} customStyles='mb-[24px]' />
                       
                        <div className='grid grid-cols-2 gap-4'>
                            {
                                children.map(({ name, value }, c) =>{
                                    return(
                                        ((name === 'mobile')) ?
                                            <div key={name + c} className={`col-span-1 min-h-[92px]`} >
                                                {/* <PhoneSelector key={name+i} title={name} name={name} value={value} minHeight='small' /> */}
                                                {name ? <Headline size='small' title={t(name)} color='black-primary' /> : ''}
                                                <PhoneInput
                                                    value={value || ''}
                                                    onChange={(e) => onPhoneChange(e, i, c)}
                                                    minHeight='small' 
                                                    preferredCountries={['tw', 'hk']}
                                                    inputClass="companyInfo-mobile"
                                                    inputStyle={{color: 'black'}}
                                                />
                                            </div>
                                        :
                                        ((companyInfo?.basic?.country != 'HongKong') ) ?
                                            <div key={name + c} className={`col-span-1 min-h-[92px] ${(name === 'BR') ? 'hidden' : ''} ${(name === 'address') ? 'hidden' : ''}  `} >
                                                {console.log('country',companyInfo?.basic?.country)}
                                                <Input
                                                    disabled={title === "subscription" || name === 'email' ? true : false}
                                                    title={t(name)}
                                                    name={name}
                                                    value={value}
                                                    onChange={(event) => onInputChange(event.target.value, i, c)}
                                                    errorText={inputsError?.[title]?.[name] || ''}
                                                />
                                            </div>
                                        :
                                        ((name != 'address')) ? 
                                            <div key={name + c} className={`col-span-1 min-h-[92px] ${(name === 'address') ? 'hidden' : ''}`} >
                                                {console.log('country',companyInfo?.basic?.country)}
                                                <Input
                                                    disabled={title === "subscription" || name === 'email' ? true : false}
                                                    title={t(name)}
                                                    name={name}
                                                    value={value}
                                                    onChange={(event) => onInputChange(event.target.value, i, c)}
                                                    errorText={inputsError?.[title]?.[name] || ''}
                                                />
                                            </div>
                                        :
                                        ''
                                    )
                                })
                            }
                        </div>
                        <div className='grid grid-cols-1 gap-4'>
                            {
                                children.map(({ name, value }, c) =>{
                                    return(
                                        (name === 'address') ? 
                                        <div key={name + c} className='col-span-1 min-h-[92px]'>
                                            <Input
                                                disabled={title === "subscription" || name === 'email' ? true : false}
                                                title={name}
                                                name={name}
                                                value={value}
                                                onChange={(event) => onInputChange(event.target.value, i, c)}
                                                errorText={inputsError?.[title]?.[name] || ''}
                                            />
                                        </div>
                                        :''
                                    )
                                })
                            }
                        </div>
                    </Card>
                )
            })}
        </Form>

    );
}

