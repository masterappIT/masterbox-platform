

import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import Button from '../src/stories/components/Button';
import { useRouter } from 'next/router';
// redux
import { useDispatch, useSelector } from 'react-redux'
import { selectUserToken, handleLogin, saveUserInfo } from '../src/redux/slices/userSlices';

import { updateObjectState } from '../src/utils/utils';
import Input from '../src/stories/components/Input';
import Icon from '../src/stories/components/Icon';
import Headline from '../src/stories/components/Headline';
import { list } from 'postcss';
import ContentText from '../src/stories/components/ContentText';
import Selector from '../src/stories/components/Selector';
import PhoneRegister from '../src/components/Auth/PhoneRegister';
import { handleRegister } from '../src/redux/slices/userSlices';
import { registerCompanyInfo } from '../src/redux/slices/companySlices';
import { selectCompanyInfo } from '../src/redux/slices/companySlices';
import errorHandler, { type } from '../src/utils/errorHandler';

import { useTranslation } from 'react-i18next';
import Dropdown from '../src/stories/components/Dropdown';
import List from '../src/stories/components/List';
import ListItem from '../src/stories/components/ListItem';
import LanguageSelector from '../src/components/Auth/LanguageSelector';


const LOGIN_EMAIL_RULE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const AuthList = ({ data, inputsData, inputsError, formMessage, setFormMessage, setComponentHandler, onInputChange, onPhoneChange, handleBtnClick, setInputsData, setInputsError, props }) => {
    const { title, description, list, button, link, password } = data;
    const userToken = useSelector(selectUserToken)
    const [phoneSelectorInputValue, setPhoneSelectorInputValue] = useState('')
    const [isShowPassword, setIsShowPassword] = useState(false)

    const onPhoneSelectorChange = (value) => {
        setPhoneSelectorInputValue(value || '')
        onPhoneChange(value)
    }

    const handleEnterKey = (e) => {
        if (e.key === 'Enter') handleBtnClick()
    }

    const handleSetComponentHandler = (to) => {

        setInputsData({})
        setInputsError({})
        setFormMessage('')
        setComponentHandler(to)

    }



    return (
        <div key='1' className='mt-[141px] flex flex-col items-center justify-start'>
            <Headline title={title} size='medium' color='white' customStyles='max-w-[300px] text-center'/>
            <div className='auth-list '>
                {formMessage && <ContentText title={formMessage} size='small' color='white' customStyles='auth-message' />}
                {description && <ContentText title={description} size='small' color='white' customStyles='text-center' />}
                {list.map(({ name, placeholder, type, option, password }, i) => {
                    return (
                        <React.Fragment key={name + i}>
                            {(type === 'input') ? <Input variant='border_b' name={name} placeholder={placeholder} value={inputsData[name] || ''} onChange={onInputChange} onKeyPress={handleEnterKey} errorText={inputsError[name] ? inputsError[name] : ''} minHeight='small' />
                                : (type === 'password') ? <Input type={isShowPassword ? 'text' : 'password'} variant='border_b' name={name} placeholder={placeholder} value={inputsData[name] || ''} onChange={onInputChange} onKeyPress={handleEnterKey} errorText={inputsError[name] ? inputsError[name] : ''} minHeight='small' endElement={<Icon name={isShowPassword ? 'eye-close' : 'eye'} customStyles='' size='small' onClick={() => setIsShowPassword(!isShowPassword)} />} />
                                : (type === 'selector') ? <Selector title='' name={name} placeholder={placeholder} variant='border_b' option={option} onChange={onInputChange} errorText={inputsError[name] ? inputsError[name] : ''} minHeight='small' />
                                : (type === 'selectorInput') ? <PhoneRegister name={name} inputValue={phoneSelectorInputValue} minHeight='small' onChange={onPhoneSelectorChange} placeholder={placeholder} inputProps={{ name: 'mobile', required: true, }} errorText={inputsError[name] ? inputsError[name] : ''} />
                                : null}
                        </React.Fragment>
                    )
                })}
                {button && <Button id={title} title={button.title} onClick={() => handleBtnClick()} color='quaternary' size='large' customStyles={{ marginTop: '20px' }} />}
                {/* <Button id={title} title={button.title} onClick={() => handleBtnClick()} color='primary' size='large' customStyles={{ marginTop: '20px' }} /> */}
                
            </div>
            <div className='w-full  flex  justify-center items-center pt-[8px] '>
                    {link.map(({ title, to }, i) => {
                        return (
                            <div className='flex' key={i + title}>
                                <ContentText title={title} size='small' color='white' onClick={() => handleSetComponentHandler(to)} customStyles={`cursor-pointer hover:underline`} />
                                {/* <ContentText  title={title} size='small' color='white' onClick={() => setComponentHandler(to)} customStyles={`cursor-pointer hover:underline`} /> */}
                                {i < link.length - 1 ? <div className='w-[1px] h-[16px] bg-black_white mx-[12px]'>&nbsp;</div> : ''}
                            </div>
                        )
                    })}
                </div>
        </div>
    )
}



function AuthPage(props) {
    const userToken = useSelector(selectUserToken)
    const companyInfo = useSelector(selectCompanyInfo)
    const { t, i18n } = useTranslation();
    const [languages, setLanguages] = useState(i18n.language)

    const router = useRouter()
    const dispatch = useDispatch()

    const [componentHandler, setComponentHandler] = useState('login');
    const [inputsData, setInputsData] = useState({})
    const [inputsError, setInputsError] = useState({})
    const [formMessage, setFormMessage] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)


    const data =
    {
        login: {
            title: "",
            list:
                [
                    { name: 'email', placeholder: t('email'), type: 'input' },
                    { name: 'password', placeholder: t('password'), type: 'password' },
                    // { name: 'remember', placeholder: '記住我的密碼', type: 'checkbox' },
                ],
            button: {
                title: isSubmitting ? t('logging_in') : t('login'),
            },
            link: [
                { title: t('forget_password'), to: 'forget' },
            ],
        },
        register: {
            title: t('register'),
            list:
                [
                    { name: 'chinese_name', placeholder: t('chinese_name'), type: 'input' },
                    { name: 'english_name', placeholder: t('english_name'), type: 'input' },
                    { name: 'email', placeholder: t('email'), type: 'input' },
                    { name: 'password', placeholder: t('password'), type: 'password' },
                    {
                        name: 'country', placeholder: t('select_your_location'), type: 'selector', option: [
                            {
                                name: 'Taiwan',
                                value: 'Taiwan',
                            },
                            {
                                name: 'Hong Kong',
                                value: 'Hong Kong',
                            },
                        ],
                    },
                    {
                        name: 'mobile', placeholder: t('mobile'), type: 'selectorInput',
                        //  option: [{
                        //     label: "台灣+886",
                        //     value: 0
                        // },
                        // {
                        //     label: "香港+852",
                        //     value: 1
                        // }]
                    },
                ],
            button: {
                title:  t('sign_up_now'),
            },
            link: [
                { title: t('log_in_to_the_management_background'), to: 'login' },
            ],
        },
        forget: {
            title: t('reset_password'),
            description: t('forgot_password_unavailable'),
            list: [],
            link: [
                { title:  t('back_to_login'), to: 'login' },
            ],
        }
    }
    const onInputChange = (e) => {
        const name = e.name || e.target.name
        const value = e.name ? e.value : e.target.value
        updateObjectState(inputsData, setInputsData, name, value)
        setFormMessage('')
    }

    const onPhoneChange = (value) => {
        updateObjectState(inputsData, setInputsData, 'mobile', value || '')
        setFormMessage('')
    }

    const handleSkipLogin = () => {
        const isDevelopmentBypassEnabled = process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_ENABLE_DEV_BYPASS === 'true';
    if (!isDevelopmentBypassEnabled) return;

    dispatch(saveUserInfo({
            token: 'local-development-token',
            email: 'demo@masterbox.local',
            _id: 'local-demo-account',
            company_id: 'local-demo-company',
            role: 'admin',
            info: { name: '示範帳戶', avatar: '', mobile: null },
        }))
        router.push('/')
    }

    const handleBtnClick = async () => {
        if (isSubmitting) return
        setInputsError({})
        setFormMessage('')

        if (componentHandler === 'login') {
            const email = (inputsData.email || '').trim()
            const password = inputsData.password || ''
            const errors = {}
            if (!email) errors.email = t('login_email_required')
            else if (!LOGIN_EMAIL_RULE.test(email) && email.toLowerCase() !== 'test') errors.email = t('login_invalid_email')
            if (!password) errors.password = t('login_password_required')
            setInputsError(errors)
            if (Object.keys(errors).length > 0) return

            setIsSubmitting(true)
            const { payload } = await dispatch(handleLogin({ email, password }))
            setIsSubmitting(false)
            if (payload?.error) setFormMessage(t(payload.error))
            return
        }

        if (componentHandler === 'register') {
            const trimmedData = { ...inputsData }
            data.register.list.forEach(({ name }) => {
                if (typeof trimmedData[name] === 'string' && name !== 'password') trimmedData[name] = trimmedData[name].trim()
            })
            setInputsData(trimmedData)

            const errors = {}
            const emailRule = /^[\w-]+(?:\.[\w-]+)*@([\w-]+\.)+[\w-]+$/
            data.register.list.forEach(({ name }) => {
                if (!trimmedData[name]) errors[name] = new errorHandler(type.INVALID_FORMAT, name).createErrorMessage()
            })
            if (!emailRule.test(trimmedData.email || '')) errors.email = new errorHandler(type.INVALID_FORMAT, 'email').createErrorMessage()
            if (!trimmedData.mobile || trimmedData.mobile.length < 5) errors.mobile = new errorHandler(type.INVALID_FORMAT, 'mobile').createErrorMessage()
            setInputsError(errors)
            if (Object.keys(errors).length === 0) dispatch(registerCompanyInfo(trimmedData))
        }
    }

    useEffect(() => {
        if (userToken) router.push('/')
    }, [userToken, router])

    useEffect(() => {
        if (!window.sessionStorage.getItem('sessionExpired')) return
        window.sessionStorage.removeItem('sessionExpired')
        setFormMessage(t('session_expired'))
    }, [])


    const changeLanguage = (lng,title) => {
        i18n.changeLanguage(lng);
        setInputsError({})
        setFormMessage('')
        setLanguages(t(title))
    };

    const list = [{ title: '繁體中文', onClick: () => { changeLanguage("zh-TW","繁體中文") } }, { title: 'English', onClick: () => { changeLanguage("en","English") } }]

    return (
        <div className="auth" >
            <div className='auth-language' >
                <LanguageSelector list={list} currentLanguages={languages} customStyle='' />
            </div>

            <Icon name='authLogo' size='login' customStyles={{ marginBottom: '10px', marginLeft: '-7px' }} />

            {process.env.NEXT_PUBLIC_ENABLE_DEV_BYPASS === 'true' && <button
                type='button'
                onClick={handleSkipLogin}
                className='mt-6 rounded border border-white px-5 py-2 text-sm text-white hover:bg-white hover:text-primary'
            >
                跳過登入（開發模式）
            </button>}

            <AuthList
                data={data[componentHandler]}
                inputsData={inputsData}
                setInputsData={setInputsData}
                setInputsError={setInputsError}
                inputsError={inputsError}
                formMessage={formMessage}
                setFormMessage={setFormMessage}
                setComponentHandler={setComponentHandler}
                onInputChange={onInputChange}
                onPhoneChange={onPhoneChange}
                handleBtnClick={handleBtnClick} />
        </div >
    )
}

AuthPage.propTypes = {}

export default AuthPage;
