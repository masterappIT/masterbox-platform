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
 * @param { string } content string
 * @param { number } value number
 * @param { string } size oneOf:'small', 'normal', 'large'
 * @param { string } errorText string
 * @param { string } description string
 * @param { element,string } customStyles oneOfType:string,object
 * @param { Func } onClick func
 */

function Radio({ title, name, list, content, value, size, description, errorText, customStyles, onClick }) {
    const isTailwind = typeof customStyles === 'string';

    return (

        <div className={`radio ${isTailwind && customStyles} `} style={!isTailwind ? { ...customStyles } : {}} >
            {title ? <Headline size='small' title={title} color='black-primary' customStyles='mb-[4px]' /> : ''}
            <div className={` radio-list `}>
                {list.map(({ content, value }, i) => {
                    return (
                        <label key={i} htmlFor={content} className='radio-list-item' >
                            <input
                                key={i}
                                id={content}
                                name={name}
                                value={content}
                                type="radio"
                                className={`radio-list-item-radio radio-list-item-radio-${size}`}
                            />
                            <ContentText title={content}/>
                        </label>
                    )
                })}
                {content ? <ContentText title={content} customStyles='radio-area-content' /> : ''}
            </div>
            {errorText ? <ErrorText customStyles='mt-[8px] pl-[1px]' /> : ''}
            {description ? <ContentText title={description} size='small' color='black-tertiary' customStyles='mt-[6px] pl-[2px]' /> : ''}
        </div>

    )

}

Radio.propTypes = {
    title: PropTypes.string,
    name: PropTypes.string,
    content: PropTypes.string,
    value: PropTypes.number,
    size: PropTypes.oneOf(['small', 'normal', 'large']),
    errorText: PropTypes.string,
    description: PropTypes.string,
    variant: PropTypes.oneOf(['primary', 'secondary', 'tertiary', 'quaternary']),
    customStyles: PropTypes.oneOfType([PropTypes.string, PropTypes.object]), 
    onClick: PropTypes.func,
}

Radio.defaultProps = {
    title: null,
    name: 'name',
    list: [
        {
            content: '123',
            value: 0
        },
        {
            content: '345345',
            value: 1
        },
        {
            content: '12345345345343',
            value: 2
        },
    ],
    content: null,
    value: 1,
    size: 'normal',
    errorText: null,
    description: null,
    color: 'primary',
    customStyles: null,
    onClick: null,
}

export default Radio
