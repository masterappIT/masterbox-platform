import React, { useState } from 'react'
import PropTypes from 'prop-types'
import Headline from './Headline';
import Card from './Card';
import ErrorText from './ErrorText';
import ContentText from './ContentText';
import Dropdown from './Dropdown';
import ListItem from './ListItem';
import List from './List';
import Input from './Input';
import Icon from './Icon';
import Checkbox from './Checkbox';
import { assertWrappingType } from 'graphql';

/**
 * Primary UI component for user interaction
 *  * 
 * @param { string } title string
 * @param { string } value any
 * @param { array } option array:[
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
 * @param { string } name string
 * @param { string } placeholder string
 * @param { string } errorText string
 * @param { string } description string
 * @param { string } variant oneOf:'outlined', 'border_b'
 * @param { string } minHeight oneOf:'none','small', 'large'
 * @param { element,string } customStyles oneOfType:string,object
 * @param { func } onClick func
 */





function Selector({ title, value, option, name, placeholder, errorText, description, variant, minHeight, customStyles, onClick }) {
    const isTailwind = typeof customStyles === 'string';
    const [checkDropDownListWidth, setCheckDropDownListWidth] = useState(0)
    const [selectValue, setSelectValue] = useState(value)

    function handleCheckListWidth(e) {
        setCheckDropDownListWidth(e.target.offsetWidth)
    }

    // show data name
    const selectedArrary = () => { return selectValue?.map(select => { return select.name }) };

    // set isChecked
    const checkIsChecked = (value) => { return selectValue.find(element => { return element.value === value }) };



    //save selector data
    let newData = []
    const handleSetSelectorValue = (e, data) => {
        let status = ''
        e.stopPropagation();
        if (e.target.type === 'checkbox') {
            status = e.target?.checked
        } else {
            if(e.target.length){

       
            let targetStatus = e.target.children[0].children[0].children[0]
            targetStatus.checked = !targetStatus.checked
            status = targetStatus?.checked
             }
        }
        status ? newData.push(...selectValue, data)
            : newData = selectValue.filter((e) => { return e.value !== data.value })
        setSelectValue(newData)
    }




    return (
        <div name={name} className={`multipleSelector multipleSelector-${minHeight}  ${isTailwind && customStyles} `} style={!isTailwind ? { ...customStyles } : {}} onClick={onClick}>
            {title ? <Headline size='small' title={title} color='black-primary' /> : ''}
            <Dropdown justify='right' distance='far' border={true}
                outSideElement={
                    <div className={`multipleSelector-bar`}>
                        <Input key={selectValue}
                            readOnly='readOnly'
                            placeholder={placeholder}
                            defaultValue={!selectValue ? '' : ''}
                            value={`${!selectValue ? '' : selectedArrary()}`}
                            customStyles={`w-full cursor-pointer `}
                            onClick={(e) => handleCheckListWidth(e)}
                            variant={variant} />
                        <Icon name='arrow-down' customStyles={`multipleSelector-bar-icon multipleSelector-bar-icon-${variant}`} size='small' />
                    </div>
                }
                customStyles={{ top: '6px', left: '0px', right: '0px', width: checkDropDownListWidth, cursor: 'pointer' }}>
                <List customStyles=''>
                    {option && option.map((data, index) => {
                        return (
                            <ListItem key={index} onClick={(e) => handleSetSelectorValue(e, data)}
                                customStyles='whitespace-nowrap cursor-pointer hover:bg-primary_light h-[36px]'>
                                <Checkbox name={data.name} value={data.value} content={data.name} defaultChecked={checkIsChecked(data.value)} />
                            </ListItem>
                        )
                    })}
                </List>
            </Dropdown>
            {errorText ? <ErrorText customStyles='mt-[8px] pl-[1px]' /> : ''}
            {description ? <ContentText title='這是說明文字' size='small' color='black-tertiary' customStyles='mt-[6px] pl-[2px]' /> : ''}
        </div>

    )

}

Selector.propTypes = {
    title: PropTypes.string,
    value: PropTypes.array,
    option: PropTypes.array,
    name: PropTypes.string,
    placeholder: PropTypes.string,
    errorText: PropTypes.string,
    description: PropTypes.string,
    variant: PropTypes.oneOf(['outlined', 'border_b']),
    minHeight: PropTypes.oneOf(['none', 'small', 'large']),
    customStyles: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
    onClick: PropTypes.func,
}

Selector.defaultProps = {
    title: null,
    value: [{
        name: '345345',
        value: 1
    },
    {
        name: '12345345345343',
        value: 2
    }
    ],
    // value: {
    //     name:  null,
    //     value: null,
    // },
    // value: [
    //     {
    //         name: '123',
    //         value: 0
    //     },
    //     {
    //         name: '345345',
    //         value: 1
    //     },
    //     {
    //         name: '12345345345343',
    //         value: 2
    //     },
    // ],
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
    name: '123',
    placeholder: '請選擇內容',
    errorText: null,
    description: null,
    variant: 'outlined',
    minHeight: 'large',
    customStyles: null,
    onClick: null,
}

export default Selector
