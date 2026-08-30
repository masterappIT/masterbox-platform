import React from 'react'
import PropTypes from 'prop-types'
import Headline from './Headline';
import Card from './Card';
import ErrorText from './ErrorText';
import ContentText from './ContentText';
import Icon from './Icon';

/**
 * Primary UI component for user interaction
 * @param { String } title string
 * @param { String } name string
 * @param { String } type oneOf_'text', 'password'
 * @param { String } defaultValue string
 * @param { String } placeholder string
 * @param { String } value string
 * @param { Element } children element
 * @param { Element } startElement element
 * @param { Element } endElement element
 * @param { String } errorText string
 * @param { String } description string
 * @param { String } variant oneOf:'outlined', 'border_b','none'
 * @param { String } minHeight oneOf:'none','small', 'large'
 * @param { Element,String } customStyles oneOfType:string,object
 * @param { Func } onClick func
 * @param { Func } onChange func
 * @param { Func } onKeyPress func
 * @param { String } readOnly string
 * @param { Bool } disabled bool
 */


function Input({ title, name, type, defaultValue, placeholder, value, children, errorText, description, variant, minHeight, customStyles,startElement,endElement, onChange, onClick, onKeyPress, readOnly, disabled }) {
    const isTailwind = typeof customStyles === 'string';

    return (
        <div className={`input input-${minHeight} input-${disabled?'disabled':''} ${isTailwind && customStyles} `} style={!isTailwind ? { ...customStyles } : {}} >
            {title ? <Headline size='small' title={title} color='black-primary' /> : ''}
            {children}
            <div className={`input-inputBar`}>
            {startElement?<div  className={`absolute left-[9px] top-[11px]`} >{startElement}</div>:''}
            {/* {console.log('defaultValue.name1',defaultValue)} */}

                {value !== undefined && value !== null ? (
                    <input
                        name={name}
                        className={`input-inputBar-input input-inputBar-${variant} input-inputBar-${variant}${(startElement&&endElement)?'-px':startElement?'-paddingLeft':endElement?'-paddingRight':'-paddingInit'} `}
                        type={type}
                        placeholder={placeholder}
                        value={value}
                        onClick={onClick}
                        onChange={onChange}
                        onKeyPress={onKeyPress}
                        readOnly={disabled ? 'readOnly' : readOnly}
                        disabled={disabled ? true : false}
                        style={disabled?{border:'none',backgroundColor:'#EFEFEF',cursor:'not-allowed'}:readOnly?{cursor:'pointer'}:{} }
                    />
                ) : (
                    <input
                        name={name}
                        className={`input-inputBar-input input-inputBar-${variant} input-inputBar-${variant}${(startElement&&endElement)?'-px':startElement?'-paddingLeft':endElement?'-paddingRight':'-paddingInit'} `}
                        type={type}
                        placeholder={placeholder}
                        defaultValue={defaultValue || ''}
                        onClick={onClick}
                        onChange={onChange}
                        onKeyPress={onKeyPress}
                        readOnly={disabled ? 'readOnly' : readOnly}
                        disabled={disabled ? true : false}
                        style={disabled?{border:'none',backgroundColor:'#EFEFEF',cursor:'not-allowed'}:readOnly?{cursor:'pointer'}:{} }
                    />
                )}
                {endElement?<div className='absolute right-[10px] top-[13px]' >{endElement}</div>:''}
                {/* {endElement?<div className='input-inputBar-icon input-inputBar-icon-end' >{endElement}</div>:''} */}
            </div>
            {/* <input
                name={name}
                className={`input-input input-input-${variant}`}
                type={type}
                placeholder={placeholder}
                // onKeyPress={pressHandler}
                // defaultValue={defaultValue}
                value={value}
                onClick={onClick}
                onChange={onChange}
                onKeyPress={onKeyPress}
                readOnly={disabled ? 'readOnly' : readOnly}
                {...disabled ? disabled : ''}
            /> */}
            {errorText ? <ErrorText customStyles='mt-[8px] pl-[1px]' title={errorText} /> : ''}
            {description ? <ContentText title={description} size='small' color='black-tertiary' customStyles='mt-[6px] pl-[2px]' /> : ''}
        </div>

    )

}

Input.propTypes = {
    title: PropTypes.string,
    value: PropTypes.any,
    name: PropTypes.string,
    type: PropTypes.oneOf(['text', 'password']),
    defaultValue: PropTypes.string,
    placeholder: PropTypes.string,
    children: PropTypes.element,
    errorText: PropTypes.string,
    description: PropTypes.string,
    variant: PropTypes.oneOf(['outlined', 'border_b', 'none']),
    minHeight: PropTypes.oneOf(['small', 'large']),
    customStyles: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
    endElement: PropTypes.element,
    startElement: PropTypes.element,
    onClick: PropTypes.func,
    onChange: PropTypes.func,
    onKeyPress: PropTypes.func,
    readOnly: PropTypes.string,
    disabled: PropTypes.bool,
}

Input.defaultProps = {
    title: null,
    value: null,
    name: null,
    type: 'text',
    defaultValue: null,
    placeholder: '請輸入內容',
    children: null,
    errorText: null,
    description: null,
    variant: 'outlined',
    minHeight: 'large',
    color: 'primary',
    customStyles: null,
    endElement: null,
    startElement: null,
    onClick: null,
    onChange: null,
    onKeyPress: null,
    readOnly: null,
    disabled: null,
}

export default Input
