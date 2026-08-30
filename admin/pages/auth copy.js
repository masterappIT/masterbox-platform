

import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import Button from '../src/stories/components/Button';
import { useRouter } from 'next/router';
// redux
import { useDispatch, useSelector } from 'react-redux'
import { selectUserToken, handleLogin } from '../src/redux/slices/userSlices';

import { updateObjectState } from '../src/utils/utils';
import Input from '../src/stories/components/Input';
import Icon from '../src/stories/components/Icon';
import Headline from '../src/stories/components/Headline';
import { list } from 'postcss';
import ContentText from '../src/stories/components/ContentText';
import Selector from '../src/stories/components/Selector';
import SelectInput from '../src/stories/components/SelectInput';
import PhoneSelector from '../src/components/Auth/PhoneSelector';
import { handleRegister } from '../src/redux/slices/userSlices';
import { registerCompanyInfo } from '../src/redux/slices/companySlices';

import { selectCompanyInfo } from '../src/redux/slices/companySlices';
import Checkbox from '../src/stories/components/Checkbox';

import errorHandler,{type} from '../src/utils/errorHandler';



const AuthList = ({ data, inputsData,inputsError, setComponentHandler, onInputChange, handleBtnClick }) => {
    const { title, list, button, link, password } = data;
    const userToken = useSelector(selectUserToken)
    const [phoneSelectorInputValue, setPhoneSelectorInputValue] = useState('')
    const [isShowPassword, setIsShowPassword] = useState(false)

    const onPhoneSelectorChange = (e) => {
        onInputChange(e)
        setPhoneSelectorInputValue(e.value)
    }



    return (
        <div className='mt-[141px] flex flex-col items-center justify-start'>
            <Headline title={title} size='medium' color='white' />
            <div className='auth-list '>
                {list.map(({ name, placeholder, type, option, password }, i) => {
                    return (
                        (type === 'input') ? <><Input key={name+i} variant='border_b' name={name} placeholder={placeholder} defaultValue='' value={inputsData[name]} onChange={onInputChange} errorText={inputsError[name]?inputsError[name]:''} minHeight='small' /></>
                            : (type === 'password') ? <Input key={name+i} type={isShowPassword ? 'text' : 'password'} variant='border_b' name={name} placeholder={placeholder} defaultValue='' value={inputsData.name} onChange={onInputChange} errorText='' minHeight='small' endElement={<Icon name={isShowPassword ? 'eye-close' : 'eye'} customStyles='' size='small' onClick={() => setIsShowPassword(!isShowPassword)} errorText={inputsError[name]?inputsError[name]:''}/>} />
                                : (type === 'selector') ? <Selector key={name+i} title='' name={name} placeholder={placeholder} variant='border_b' minHeight='small' option={option} onChange={onInputChange} errorText={inputsError[name]?inputsError[name]:''}/>
                                    : (type === 'selectorInput') ? <PhoneSelector key={name+i} name={name} inputValue={phoneSelectorInputValue} minHeight='small' placeholder={placeholder} onChange={onPhoneSelectorChange} errorText={inputsError[name]?inputsError[name]:''} /> : ''
                        // : (type === 'checkbox') ? <Checkbox key={i} name={name} content='記住我的密碼' checkboxColor='secondary' labelColor='white'/> : ''
                    )
                })}
                <Button id={title} title={button.title} onClick={() => handleBtnClick()} color='quaternary' size='large' customStyles={{ marginTop: '20px' }} />
                {/* <Button id={title} title={button.title} onClick={() => handleBtnClick()} color='primary' size='large' customStyles={{ marginTop: '20px' }} /> */}
                <div className='w-full  flex  justify-center items-center pt-[8px] '>
                    {link.map(({ title, to }, i) => {
                        return (
                            <div className='flex' key={i + title}>
                                <ContentText key={i} title={title} size='small' color='white' onClick={() => setComponentHandler(to)} customStyles={`cursor-pointer hover:underline`} />
                                {i < link.length - 1 ? <div className='w-[1px] h-[16px] bg-black_white mx-[12px]'>&nbsp;</div> : ''}
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}



function AuthPage(props) {
    const userToken = useSelector(selectUserToken)
    const companyInfo = useSelector(selectCompanyInfo)

    const router = useRouter()
    const dispatch = useDispatch()

    const [componentHandler, setComponentHandler] = useState('login');
    const [inputsData, setInputsData] = useState({})
    const [inputsError, setInputsError] = useState({})

    const data =
    {
        login: {
            title: "",
            list:
                [
                    { name: 'email', placeholder: 'Email', type: 'input' },
                    { name: 'password', placeholder: '密碼', type: 'password' },
                    { name: 'remember', placeholder: '記住我的密碼', type: 'checkbox' },
                ],
            button: {
                title: "登入",
            },
            link: [
                { title: '免費註冊試用', to: 'register' },
                { title: '忘記密碼?', to: 'forget' },
            ],
        },
        register: {
            title: "填入資料，立即開啟免費試用！",
            list:
                [
                    { name: 'chinese_name', placeholder: '中文公司名稱', type: 'input' },
                    { name: 'english_name', placeholder: '英文公司名稱', type: 'input' },
                    { name: 'email', placeholder: 'Email', type: 'input' },
                    { name: 'password', placeholder: '密碼', type: 'password', password: true },
                    // { name: '輸入館場中文名稱', placeholder: '輸入館場中文名稱', type: 'input' },
                    // { name: '輸入館場英文名稱', placeholder: '輸入館場英文名稱', type: 'input' },
                    {
                        name: 'country', placeholder: '請選擇所在地區', type: 'selector', option: [
                            {
                                name: '台灣',
                                value: '台灣',
                            },
                            {
                                name: '香港',
                                value: '香港',
                            },
                            // {
                            //     name: '中國',
                            //     value: '中國',
                            // },
                        ],
                    },
                    {
                        name: 'mobile', placeholder: '', type: 'selectorInput', option: [{
                            label: "台灣+886",
                            value: 0
                        },
                        {
                            label: "香港+852",
                            value: 1
                        }]
                    },
                ],
            button: {
                title: "立即註冊",
            },
            link: [
                { title: '登入管理後台', to: 'login' },
                { title: '忘記密碼?', to: 'forget' },
            ],
        },
        forget: {
            title: "重設密碼",
            list:
                [
                    { name: 'email', placeholder: 'Email', type: 'input' },
                ],
            button: {
                title: "寄送密碼至信箱",
            },
            link: [
                { title: '免費註冊試用', to: 'register' },
                { title: '返回登入', to: 'login' },
            ],
        }
    }
    const onInputChange = (e) => {

        if (e.name) {
            updateObjectState(inputsData, setInputsData, e.name, e.value)
        } else {
            const { name, value } = e.target;
            updateObjectState(inputsData, setInputsData, name, value)
        }

    }



    const handleBtnClick = () => {
        if (componentHandler === 'login') {
            const res = dispatch(handleLogin(inputsData))
        } else if (componentHandler === 'register') {
            setInputsError({})
            const emailRule =  /[\w-]+@([\w-]+\.)+[\w-]+/;
            const mobileRule = /\+\d{4}/;

            let errorMessages={}

            if(emailRule.test(inputsData.email) != true) errorMessages['email']=new errorHandler(type.INVALID_FORMAT, 'email').createErrorMessage()
            if(mobileRule.test(inputsData.mobile) != true)  errorMessages['mobile']=new errorHandler(type.INVALID_FORMAT, 'mobile').createErrorMessage()
            data[componentHandler].list.forEach(({name},i)=>{
                (inputsData[name] ===null || inputsData[name] === undefined) ? errorMessages[name]=`${name} Error`:''
            })
            setInputsError(errorMessages)
            
            if(Object.keys(errorMessages).length === 0)  dispatch(registerCompanyInfo(inputsData))
        }
    }

    useEffect(() => {
        if (userToken) router.push('/')
    }, [userToken, router])

    return (
        <div className="auth" >
            <Icon name='authLogo' size='login' customStyles={{ marginBottom: '10px', marginLeft: '-7px' }} />
            <AuthList data={data[componentHandler]} inputsData={inputsData} setInputsData={setInputsData} inputsError={inputsError} setComponentHandler={setComponentHandler} onInputChange={onInputChange} handleBtnClick={handleBtnClick} />
            {/* <span className='text-white'>isLogin:{userToken ? 'true' : 'false'}</span> */}

        </div >
    )
}

AuthPage.propTypes = {}

export default AuthPage
{/* <input name="email" type="text" value={loginData.email} onChange={(e) => updateObjectState(loginData, setLoginData, 'email', e.target.value)} />
<input name="password" type="password" value={loginData.password} onChange={(e) => updateObjectState(loginData, setLoginData, 'password', e.target.value)} /> */}


            // ^\w+：@ 之前必須以一個以上的文字&數字開頭，例如 abc
            // ((-\w+)：@ 之前可以出現 1 個以上的文字、數字或「-」的組合，例如 -abc-
            // (\.\w+))：@ 之前可以出現 1 個以上的文字、數字或「.」的組合，例如 .abc.
            // ((-\w+)|(\.\w+))*：以上兩個規則以 or 的關係出現，並且出現 0 次以上 (所以不能 –. 同時出現)
            // @：中間一定要出現一個 @
            // [A-Za-z0-9]+：@ 之後出現 1 個以上的大小寫英文及數字的組合
            // (\.|-)：@ 之後只能出現「.」或是「-」，但這兩個字元不能連續時出現
            // ((\.|-)[A-Za-z0-9]+)*：@ 之後出現 0 個以上的「.」或是「-」配上大小寫英文及數字的組合
            // \.[A-Za-z]+$/：@ 之後出現 1 個以上的「.」配上大小寫英文及數字的組合，結尾需為大小寫英文
            
            // 「^」 表示是開始必須符合的格式
            // 「$ 」表示是結尾必須符合的格式
            // 「\w」表示英文或數字
            // 「\d」表示只能為數字
            // 「\.」表示 「.」，前面的 \ 為跳脫字元 (escape)
            // 「\-」表示 「-」，前面的 \ 為跳脫字元 (escape)
            // 「|」表示 or ，即左右兩邊只能出現其中一個
            // 「+」表示出現 1 次以上
            // 「*」表示出現 0 次以上
            // 「A-Z」表示英文大寫 A ~ Z
            // 「a-z」表示英文小寫 a ~ z
            // 「0-9」表示數字 0 ~ 9，同「\d」
            // [A-Za-z0-9] 表示大小寫英文及數字的組合