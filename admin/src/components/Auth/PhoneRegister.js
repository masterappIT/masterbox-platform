

import React, { useState } from 'react'
import PropTypes from 'prop-types'
import PhoneInput from 'react-phone-input-2'
import 'react-phone-input-2/lib/style.css'
import ErrorText from '../../stories/components/ErrorText'





function PhoneRegister({ name, minHeight, inputValue, placeholder, onChange, errorText }) {
    return (
        <div className='min-h-[65px]'>
            <PhoneInput
                placeholder={placeholder}
                value={inputValue}
                preferredCountries={['tw', 'hk']}
                onChange={onChange}
                minHeight='small'
                inputProps={{
                    name: 'mobile',
                    required: true,
                }}
                containerStyle={{ borderBottom: '1.3px solid white' }}
                inputStyle={{ color: 'white', borderRadius: '0px', border: 'none' }}

            />
            {errorText ? <ErrorText customStyles='mt-[8px] pl-[1px]' title={errorText} /> : ''}
        </div>
    )
}
PhoneRegister.propTypes = {
    title: PropTypes.string,
    name: PropTypes.string,
    defaultValue: PropTypes.string,
    inputValue: PropTypes.string,
    placeholder: PropTypes.string,
    errorText: PropTypes.string,
    description: PropTypes.string,
    variant: PropTypes.oneOf(['outlined', 'border_b', 'none']),
    minHeight: PropTypes.oneOf(['small', 'large']),
    customStyles: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
    onClick: PropTypes.func,
    onChange: PropTypes.func,
    readonly: PropTypes.string,
}

PhoneRegister.defaultProps = {
    title: null,
    name: null,
    defaultValue: null,
    inputValue: null,
    placeholder: '請輸入內容',
    errorText: null,
    description: null,
    variant: 'outlined',
    minHeight: 'large',
    color: 'primary',
    customStyles: null,
    onClick: null,
    onChange: null,
    readonly: null,
}


export default PhoneRegister