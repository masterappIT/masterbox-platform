

import React, { useState } from 'react'
import PropTypes from 'prop-types'
import SelectInput from '../../stories/components/SelectInput'






function PhoneSelector({ name, minHeight, selectorValue,inputValue, onChange,errorText }) {
    const [inputsValueDefault, setInputsValueDefault] = useState(selectorValue.value)

    const option = [
        {
            name: '台灣',
            value: '+886'
        },
        {
            name: '香港',
            value: '+852'
        },
        {
            name: '中國',
            value: '+86'
        },
    ]

    return (
        <>
            <SelectInput
                name={name}
                selectorValue={selectorValue}
                inputValue={inputValue}
                minHeight={minHeight}
                option={option}
                selectorPlaceholder='請先選擇地區'
                inputPlaceholder='請輸入電話號碼'
                onChange={onChange}
                errorText={errorText}
            />
        </>
    )
}
PhoneSelector.propTypes = {
    title: PropTypes.string,
    name: PropTypes.string,
    selectorValue: PropTypes.any,
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

PhoneSelector.defaultProps = {
    title: null,
    name: null,
    selectorValue: {
        name: '選擇地區',
        value: '',
    },
    // selectorValue: {
    //     name: '台灣',
    //     value: '+886',
    // },
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


export default PhoneSelector
