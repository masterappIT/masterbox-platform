import React ,{useState}from 'react'
import PropTypes from 'prop-types'
import Headline from './Headline';
import Card from './Card';
import ErrorText from './ErrorText';
import ContentText from './ContentText';
import Selector from './Selector';
import Input from './Input';

/**
 * Primary UI component for user interaction
 *  * 
 * 
 * selector
 * @param { string } name string
 * @param { string } placeholder string
 * @param { string } errorText string
 * @param { string } description string
 * @param { string } variant oneOf:'outlined', 'border_b'
 * @param { string } minHeight oneOf:'small', 'large'
 * @param { bool } inFormList bool
 * @param { element,string } customStyles oneOfType:string,object
 * @param { func } onClick func
 * inputs
 * @param { string } title string
 * @param { string } name string
 * @param { string } defaultValue string
 * @param { string } placeholder string
 * @param { string } value string
 * @param { string } errorText string
 * @param { string } description string
 * @param { string } variant oneOf:'outlined', 'border_b'
 * @param { string } minHeight oneOf:'small', 'large'
 * @param { element,string } customStyles oneOfType:string,object
 * @param { func } onChange func
 * @param { string } readonly string
 */


function SelectInput({ title,option,selectorValue,inputValue,selectorPlaceholder,inputPlaceholder, name, defaultValue, placeholder, value, errorText, description, variant, minHeight, customStyles, onChange, onClick, readonly }) {
    const isTailwind = typeof customStyles === 'string';
    const [isSelector, setIsSelector] = useState(null);


    return (
        <>

            <div className={`selectInput selectInput-${minHeight} ${isTailwind && customStyles} `} style={!isTailwind ? { ...customStyles } : {}} >
                {title ? <Headline size='small' title={title} color='black-primary' /> : ''}
                <div className={`selectInput-bar electInput-bar-${variant} w-full flex`}>
                    <Selector name={name} variant='border_b' customStyles={{ width: '100px' }} placeholder={selectorPlaceholder} value={selectorValue} option={option} onChange={onChange}/>
                    <Input name={name} variant='border_b' customStyles='flex-1' placeholder={isSelector?selectorPlaceholder:inputPlaceholder} value={inputValue} onChange={onChange}/>
                    {/* <Input variant='border_b' customStyles='flex-1' placeholder={isSelector?selectorPlaceholder:inputPlaceholder} disabled={!isSelector}/> */}
                </div>
                {errorText ? <ErrorText customStyles='mt-[8px] pl-[1px]' title={errorText}/> : ''}
                {description ? <ContentText title={description} size='small' color='black-tertiary' customStyles='mt-[6px] pl-[2px]' /> : ''}
            </div>
        </>

    )

}

SelectInput.propTypes = {
    title: PropTypes.string,
    option: PropTypes.array,
    selectorValue: PropTypes.any,
    inputValue: PropTypes.any,
    selectorPlaceholder: PropTypes.any,
    inputPlaceholder: PropTypes.any,
    variant: PropTypes.oneOf(['outlined', 'border_b']),
    minHeight: PropTypes.oneOf(['small', 'large']),
    errorText: PropTypes.string,
    description: PropTypes.string,

    // ---selector
    name: PropTypes.string,
    placeholder: PropTypes.string,
    inFormList: PropTypes.bool,
    customStyles: PropTypes.oneOfType([PropTypes.string, PropTypes.object]), 
    onClick: PropTypes.func,
    // ---input
    name: PropTypes.string,
    defaultValue: PropTypes.string,
    placeholder: PropTypes.string,
    customStyles: PropTypes.oneOfType([PropTypes.string, PropTypes.object]), 
    onChange: PropTypes.func,
    readonly: PropTypes.string,
}

SelectInput.defaultProps = {

    title: null,
    option: [
        {
            name: '123',
            value: 0
        },
        {
            name: '345345',
            value: 1
        },
        {
            name: '12345345345343',
            value: 2
        },
    ],
    selectorValue: null,
    inputValue: null,
    selectorPlaceholder: '請先選擇',
    inputPlaceholder: '請輸入',
    variant: 'outlined',
    minHeight: 'large',
    errorText: null,
    description: null,

    // ---selector
    name: null,
    defaultValue: null,
    placeholder: '請輸入內容',
    color: 'primary',
    customStyles: null,
    onClick: null,
    onChange: null,
    readonly: null,
    // ---input
    name: '123',
    placeholder: null,
    customStyles: null,
}

export default SelectInput
