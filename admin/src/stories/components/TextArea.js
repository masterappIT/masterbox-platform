import React from 'react'
import PropTypes from 'prop-types'
import Headline from './Headline';
import Card from './Card';
import ErrorText from './ErrorText';
import ContentText from './ContentText';

/**
 * Primary UI component for user interaction
 *  * 
 * @param { string } title string
 * @param { string } name string
 * @param { string } placeholder string
 * @param { string } value string
 * @param { string } errorText string
 * @param { string } description string
 * @param { string } variant oneOf:'outlined', 'border_b','none'
 * @param { string } minHeight oneOf:'small', 'large'
 * @param { element,string } customStyles oneOfType:string,object
 * @param { func } onClick func
 * @param { func } onChange func
 * @param { func } onKeyPress func
 * @param { string } readOnly string
 */


function TextArea({ title, name,cols,rows,value,placeholder,errorText,description, variant,minHeight,customStyles, onChange,onClick,onKeyPress,readOnly }) {
    const isTailwind = typeof customStyles === 'string';

    return (
        <div className={`textArea textArea-${minHeight} ${isTailwind && customStyles} `} style={!isTailwind ? { ...customStyles } : {}} >
            {title?<Headline size='small' title={title} color='black-primary' />:''}
            <textarea
                name={name}
                className={`textArea-textArea textArea-textArea-${variant}`}
                type='text' 
                placeholder={placeholder}
                // onKeyPress={pressHandler}
                // defaultValue={defaultValue}
                value={value}
                cols={cols} 
                rows={rows}
                onClick={onClick}
                onChange={onChange}
                onKeyPress={onKeyPress}
                readOnly={readOnly}
            ></textarea>
            {errorText?<ErrorText customStyles='mt-[8px] pl-[1px]' />:''}
            {description?<ContentText title={description} size='small' color='black-tertiary' customStyles='mt-[6px] pl-[2px]' />:''}
        </div>

    )

}

TextArea.propTypes = {
    title: PropTypes.string,
    name: PropTypes.string,
    value: PropTypes.any,
    cols:PropTypes.number, 
    rows:PropTypes.number,
    // defaultValue: PropTypes.string,
    placeholder: PropTypes.string,
    errorText: PropTypes.string,
    description: PropTypes.string,
    variant: PropTypes.oneOf(['outlined', 'border_b','none']),
    minHeight: PropTypes.oneOf(['small', 'large']),
    customStyles: PropTypes.oneOfType([PropTypes.string, PropTypes.object]), 
    onClick: PropTypes.func,
    onChange: PropTypes.func,
    onKeyPress: PropTypes.func,
    readOnly: PropTypes.string,
}

TextArea.defaultProps = {
    title: null,
    name:null,
    value:null,
    cols:30, 
    rows:5,
    // defaultValue:null,
    placeholder:'請輸入內容',
    errorText:null,
    description:null,
    variant:'outlined',
    minHeight:'large',
    color: 'primary',
    customStyles: null,
    onClick: null,
    onChange: null,
    onKeyPress: null,
    readOnly: null,
}

export default TextArea
