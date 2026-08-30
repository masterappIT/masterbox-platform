import React from 'react'
import PropTypes from 'prop-types'
import Headline from './Headline';
import Card from './Card';
import ErrorText from './ErrorText';
import ContentText from './ContentText';


/**
 * Primary UI component for user interaction
 * 
 * @param { String } title string
 * @param { String } name string
 * @param { String } content string
 * @param { Number } value number
 * @param { String } size oneOf:'small', 'normal', 'large'
 * @param { String } checkboxColor oneOf:'primary', 'secondary'
 * @param { String } labelColor oneOf:'primary', 'secondary'
 * @param { String } errorText string
 * @param { String } description string
 * @param { Element,String } customStyles oneOfType:string,object
 * @param { Func } onClick func
 */

function Checkbox({ title, name,content, value, defaultChecked, checked, size,checkboxColor,labelColor,description, errorText, customStyles, onClick, onChange }) {
    const isTailwind = typeof customStyles === 'string';

    return (

        <div className={`checkbox ${isTailwind && customStyles} `} style={!isTailwind ? { ...customStyles } : {}} >
            {title?<Headline size='small' title={title} color='black-primary' customStyles='mb-[4px]'/>:''}
            <label className={` checkbox-area `}>
                <input
                    name={name}
                    value={value}
                    type="checkbox"
                    className={`checkbox-area-checkbox checkbox-area-checkbox-${size} checkbox-area-checkbox-${checkboxColor}`}
                    defaultChecked={defaultChecked}
                    checked={checked}
                    onChange={onClick}
                />
                {content?<ContentText title={content} customStyles='checkbox-area-content' color={labelColor}/>:''}
            </label>
            {errorText ? <ErrorText customStyles='mt-[8px] pl-[1px]' /> : ''}
            {description ? <ContentText title={description} size='small' color='black-tertiary' customStyles='mt-[6px] pl-[2px]' /> : ''}
        </div>

    )

}

Checkbox.propTypes = {
    title: PropTypes.string,
    name: PropTypes.string,
    content: PropTypes.string,
    value: PropTypes.number,
    size: PropTypes.oneOf(['small', 'normal', 'large']),
    checkboxColor: PropTypes.oneOf(['primary', 'secondary']),
    labelColor: PropTypes.oneOf(['primary', 'secondary', 'alert','white','black-primary', 'black-secondary', 'black-tertiary', 'black-quaternary']),
    errorText: PropTypes.string,
    description: PropTypes.string,
    variant: PropTypes.oneOf(['primary', 'secondary', 'tertiary', 'quaternary']),
    customStyles: PropTypes.oneOfType([PropTypes.string, PropTypes.object]), 
    defaultChecked: PropTypes.bool,
    checked: PropTypes.bool,
    onClick: PropTypes.func,
}

Checkbox.defaultProps = {
    title: null,
    name: null,
    content: null,
    value: 1,
    size: 'normal',
    checkboxColor:'primary',
    labelColor:'primary',
    errorText: null,
    description: null,
    color: 'primary',
    customStyles: null,
    onClick: null,
}

export default Checkbox
