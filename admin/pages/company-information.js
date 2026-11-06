/* eslint-disable no-unused-expressions */
import Input from "../src/stories/components/Input";
import React, { useState, useEffect, useMemo } from "react";
import { useDispatch } from "react-redux";
import { saveCompanyInfo } from "../src/redux/slices/companySlices";
import { updateCompanyInfo, fetchCompanyInfo } from '../src/redux/slices/companySlices';
import validator from 'validator';
import ErrorText from '../src/stories/components/ErrorText';
import PhoneInput from 'react-phone-input-2'
import 'react-phone-input-2/lib/style.css'

import PhoneSelector from '../src/components/Auth/PhoneSelector';

//components

import { useSelector } from "react-redux";
import { selectCompanyInfo } from '../src/redux/slices/companySlices';
import Card from "../src/stories/components/Card";
import Loading from "../src/stories/components/Loading";
import Headline from "../src/stories/components/Headline";
import Button from "../src/stories/components/Button";
import Form from "../src/stories/components/Form";
import Selector from "../src/stories/components/Selector";
import Dropdown from "../src/stories/components/Dropdown";
import Checkbox from "../src/stories/components/Checkbox";
import Radio from "../src/stories/components/Radio";
import { keyValueGenerator, initFormData } from "../src/utils/utils";
import { selectUserToken } from '../src/redux/slices/userSlices';

import { useTranslation } from 'react-i18next';


// Registered company names can mix scripts, as in "MasterBox 示範公司".
const COMPANY_CHINESE_NAME = /[㐀-鿿]/;
const COMPANY_ENGLISH_NAME = /^[A-Za-z0-9][A-Za-z0-9 .,&'()-]*$/;
// The principal's Chinese name has to match their ID, so it stays Chinese, with name separators allowed.
const PERSON_CHINESE_NAME = /^[㐀-鿿·・‧]+$/;
const PERSON_ENGLISH_NAME = /^[A-Za-z]+(?:[ .'-]+[A-Za-z]+)*\.?$/;
const DIGITS = /^[0-9]+$/;

let dataStructure = {
    basic: ['chinese_name', "english_name", 'email', 'mobile', 'pin_number', 'address'],
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

        // Every field is shown even when the section is still empty, so a new company can fill it in.
        dataStructure[key].forEach((childKey) => {
            dataSets.children.push({ name: childKey, value: data[key]?.[childKey] || "" })
        })

        inputData.push(dataSets)
    })

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
    // Loaded once the company itself has arrived; the principal and subscription may still be empty.
    const isLoaded = inputsData.length === Object.keys(dataStructure).length && Boolean(companyInfo?.basic?._id)

    const cancelClick = () => {
        if (!isLoaded || isSaving) return
        setInputsData(inputDataGenerator(companyInfo));
        setInputsError(null)
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

        const invalid = (name) => `請輸入正確的${t(name)}`
        const isPhone = (value) => validator.isMobilePhone(value, ['zh-TW', 'zh-HK', 'zh-CN'])

        if (!COMPANY_CHINESE_NAME.test(chinese_name)) errorMessages['basic']['chinese_name'] = invalid('chinese_name')
        if (!COMPANY_ENGLISH_NAME.test(english_name)) errorMessages['basic']['english_name'] = invalid('english_name')
        if (!validator.isEmail(email)) errorMessages['basic']['email'] = invalid('email')
        if (!isPhone(mobile)) errorMessages['basic']['mobile'] = invalid('mobile')
        if (!DIGITS.test(pin_number)) errorMessages['basic']['pin_number'] = invalid('pin_number')

        if (!PERSON_ENGLISH_NAME.test(principal_first_name)) errorMessages['principal_info']['first_name'] = invalid('first_name')
        if (!PERSON_ENGLISH_NAME.test(principal_last_name)) errorMessages['principal_info']['last_name'] = invalid('last_name')
        if (!PERSON_CHINESE_NAME.test(principal_cn_name)) errorMessages['principal_info']['cn_name'] = invalid('cn_name')
        if (!isPhone(principal_mobile)) errorMessages['principal_info']['mobile'] = invalid('mobile')


        setInputsError(errorMessages);
        if (Object.keys(errorMessages.basic).length === 0 && Object.keys(errorMessages.principal_info).length === 0 && Object.keys(errorMessages.subscription).length === 0) { setInputsError(null); return true }

    }

    const saveClick = async () => {
        if (isSaving || !checkInputsData()) return;

        setIsSaving(true)
        let updatedData = {}

        inputsData.forEach(({ title, children }) => {
            // The plan is read-only here; the update input has no fields for it.
            if (title === 'subscription') return

            const updatedChildren = children.filter(({ name, value }) => value !== companyInfo?.[title]?.[name])
            if (updatedChildren.length === 0) return

            if (title === 'principal_info') {
                // Saving replaces the whole principal, so one change has to bring the other fields along.
                updatedData.principal_info = Object.fromEntries(children.map(({ name, value }) => [name, value]))
                return
            }

            updatedChildren.forEach(({ name, value }) => {
                updatedData[name] = value
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



    if (!isLoaded) return <div className='flex justify-center pt-[96px]'><Loading /></div>

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
                                                {inputsError?.[title]?.[name] ? <ErrorText customStyles='mt-[8px] pl-[1px]' title={inputsError[title][name]} /> : ''}
                                            </div>
                                        :
                                        ((companyInfo?.basic?.country != 'HongKong') ) ?
                                            <div key={name + c} className={`col-span-1 min-h-[92px] ${(name === 'address') ? 'hidden' : ''}  `} >
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
                                                title={t(name)}
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

