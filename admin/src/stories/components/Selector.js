import React, { useState, useEffect } from 'react'
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
import { handleSelect } from '../../utils/utils';

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
 * @param { func } onChange func
 */





function Selector({ title, multiple, handleOnClick, value, defaultValue, option, name, placeholder, errorText, description, variant, flex, minHeight, customStyles, onClick, onChange }) {
    const isTailwind = typeof customStyles === 'string';
    const [checkDropDownListWidth, setCheckDropDownListWidth] = useState(0)
    const [selectedItems, setSelectedItems] = useState([])

    const [placeholderText, setPlaceholderText] = useState('請選擇')



    function handleCheckListWidth(e) {
        setCheckDropDownListWidth(e.target.offsetWidth)
    }
    function handleOnSelect(item) {
        console.log('item', item)
        

        if (!handleOnClick) {

            handleSelect(item, selectedItems, setSelectedItems, multiple)

            if (selectedItems.length) {

                const names = selectedItems.map(item => item.name)

                setPlaceholderText(names.join(', '))
            }

            if (onChange) onChange({ name: name, value: item.value, icon: item.icon })


        }

        console.log('setSelectorValue', selectedItems)
    }


    return (
        <div className={`selector selector-${minHeight}  ${isTailwind && customStyles}  `} style={!isTailwind ? { ...customStyles } : {}} onClick={onClick}>
            {title ? <Headline size='small' title={title} color='black-primary' /> : ''}
            <Dropdown justify='right' distance='far' border={true}

                outSideElement={

                    <div className={`selector-selectorBar`}>
                        {/* {console.log('defaultValue.name',defaultValue.name)} */}

                        <Input name={name} key={selectedItems} readOnly='readOnly' placeholder={placeholder} defaultValue={defaultValue?.name} value={selectedItems.map((item, i) => item.name)} customStyles={`w-full cursor-pointer `} onClick={(e) => handleCheckListWidth(e)} variant={variant}

                            minHeight='none'
                            startElement={selectedItems && selectedItems.icon ? <Icon name={selectedItems.icon} /> : defaultValue && defaultValue.icon ? <Icon name={defaultValue.icon} /> : null}

                            endElement={<Icon name='arrow-down' customStyles={`selector-selectorBar-icon selector-selectorBar-icon-${variant}`} size='small' />}
                        />

                    </div>
                }
                customStyles={{ top: '6px', left: '0px', right: '0px', width: checkDropDownListWidth, cursor: 'pointer' }}>
                <List customStyles='' >
                    {option && option.map((data, index) => {
                        return (
                            <ListItem key={index} onClick={() => handleOnSelect(data)}
                                customStyles='whitespace-nowrap cursor-pointer hover:bg-primary_light h-[36px]'
                                startElement={data.icon ? <Icon name={data.icon} /> : null}
                            >
                                <div className={name} data={data.value}>
                                    {/* {console.log('data',data)} */}
                                    <ContentText title={data.name} size='normal' color='black-primary'></ContentText>
                                </div>
                            </ListItem>
                        )
                    })}
                </List>
            </Dropdown>
            {errorText ? <ErrorText customStyles='mt-[8px] pl-[1px]' title={errorText} /> : ''}
            {description ? <ContentText title='這是說明文字' size='small' color='black-tertiary' customStyles='mt-[6px] pl-[2px]' /> : ''}
        </div>

    )

}

Selector.propTypes = {
    title: PropTypes.string,
    value: PropTypes.any,
    defaultValue: PropTypes.any,
    option: PropTypes.array,
    name: PropTypes.string,
    placeholder: PropTypes.string,
    errorText: PropTypes.string,
    description: PropTypes.string,
    flex: PropTypes.oneOf(['row', 'col']),
    variant: PropTypes.oneOf(['outlined', 'border_b']),
    minHeight: PropTypes.oneOf(['none', 'small', 'large']),
    customStyles: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
    onClick: PropTypes.func,
    onChange: PropTypes.func,
}

Selector.defaultProps = {
    title: null,
    value: null,
    defaultValue: null,
    option: [
        {
            name: '123',
            icon: null,
            value: 0
        },
        {
            name: '345345',
            icon: null,
            value: 1
        },
        {
            name: '12345345345343',
            icon: null,
            value: 2
        },
    ],
    name: '123',
    placeholder: '請選擇內容',
    errorText: null,
    description: null,
    flex: 'col',
    variant: 'outlined',
    minHeight: 'large',
    customStyles: null,
    onClick: null,
    onChange: null,
}

export default Selector
