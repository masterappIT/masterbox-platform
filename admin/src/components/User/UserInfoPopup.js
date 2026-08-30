import React, { useEffect, useState, useMemo } from "react";
import PropTypes from 'prop-types'
import Button from "../../stories/components/Button";
import Popup from "../../stories/components/Popup";
import Input from "../../stories/components/Input";
import ImageBox from "../../stories/components/ImageBox";
import Headline from "../../stories/components/Headline";
import UploadImage from "../../stories/components/UploadImage";



function TopInfo(title) {

    return (
        <>
            <ImageBox src={logo} />
            <Headline title={title} size='medium' color='black-secondary' customStyles='mt-[24px] mb-[26px]' />
        </>
    )
}



function UserInfoPopup({ isShow, logo, onClick, currentComponent }) {

    // const [currentData, setCurrentData] = useState(currentComponent)
    const [currentData, setCurrentData] = useState('basicInfo')

    if (currentComponent === 'basicInfo' && typeof document !== 'undefined') {
        const uploadImage = document.getElementsByClassName('userInfoPopup-top')[0]
        if (uploadImage) uploadImage.classList.add('userInfoPopup-top-basic')
    }


    const data = {
        addPassword: {
            top: {
                type: 'title',
                content: '修改您的密碼'
            },
            body: [
                { name: 'password', title: '密碼', placeholder: '請輸入6-18位數密碼，請區分大小寫', type: 'password' },
                { name: 'checkPassword', title: '請輸入密碼', placeholder: '請再一次輸入您設置的密碼', type: 'password' },
            ],
            bottom: [
                { title: '確定', variant: 'contained', color: 'primary', onClick: () => { } },
            ],
        },
        basicInfo: {
            top: {
                type: 'avatar',
                content: {
                    name: 'img',
                    value: 'name',
                    description:'支援 PNG, JPEG, GIF 等常見圖片格式，大小需小於 1 MB。'
                }
            },
            body: [
                { name: 'password', title: '使用者名稱', placeholder: '使用者名稱', type: 'input' },
                { name: 'checkPassword', title: '電子信箱', placeholder: '邀請的電子信箱', type: 'disabledInput' },
            ],
            bottom: [
                { title: '重設密碼', variant: 'outlined', color: 'grayscale', onClick: () => { setCurrentData('resetPassword')} },
                { title: '保存', variant: 'contained', color: 'primary', onClick: () => { } },
            ]

        },
        resetPassword: {
            top: {
                type: 'title',
                content: '新增您的密碼'
            },
            body: [
                { name: 'oldPassword', title: '修改您的密碼', placeholder: '請輸入您的舊密碼', type: 'password' },
                { name: 'password', title: '新密碼', placeholder: '請輸入6-18位數密碼，請區分大小寫', type: 'password' },
                { name: 'checkPassword', title: '確認新密碼', placeholder: '請再一次輸入您設置的密碼', type: 'password' },
            ],
            bottom: [
                { title: '返回', variant: 'contained', color: 'grayscale', onClick: () => { setCurrentData('basicInfo') } },
                { title: '保存', variant: 'contained', color: 'primary', onClick: () => { } },
            ]

        }
    }

    const { top, body, bottom } = data[currentData]
console.log('top.name',top.content.name)
    return (
        <Popup isShow={isShow ? true : false} onClick={onClick} size='small' customStyles='userInfoPopup '>
            <div className="userInfoPopup-top">
                {currentData !== 'basicInfo' ? (
                    <>
                        <ImageBox src={logo} />
                        <Headline title={top.content} size='medium' color='black-secondary' customStyles='mt-[24px] mb-[26px]' />
                    </>
                ):(
                    <UploadImage name={top.content.name} description={top.content.description} />
                )}

            </div>
            <div className="userInfoPopup-body">
                {console.log("data[currentData]", bottom)}
                {body.map(({ name, title,placeholder, type }) => {
                    return (
                        <React.Fragment key={name}>
                            {(type!=='disabledInput')?
                            <Input name={name} title={title} placeholder={placeholder} size='small' />
                            : <Input name={name} title={title} placeholder={placeholder} size='small' disabled/>}
                        </React.Fragment>
                    )
                })}
            </div>
            <div className="userInfoPopup-bottom">
                {/* {currentData!=='basicInfo'} */}
                {bottom.map(({ title, variant, color, onClick }, i) => {
                    return (
                        <Button key={title + i} customStyles='flex-1' title={title} variant={variant} color={color} onClick={onClick} />
                    )
                })}
                {/* <Button customStyles='flex-1' variant='outlined' />
                <Button customStyles='flex-1' /> */}
            </div>

        </Popup>

    );
}

UserInfoPopup.propTypes = {
    isShow: PropTypes.bool,
    onClick: PropTypes.func,
    logo: PropTypes.string,
    currentComponent: PropTypes.oneOf(['addPassword', 'basicInfo', 'resetPassword'])

}

UserInfoPopup.defaultProps = {
    isShow: false,
    onClick: null,
    logo: '/img/logo.svg',
    currentComponent: 'addPassword',

}

export default UserInfoPopup
