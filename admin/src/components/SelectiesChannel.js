import React , { useState } from 'react'
import PropTypes from 'prop-types'
import Headline from '../stories/components/Headline';
import Button from '../stories/components/Button';
import Checkbox from '../stories/components/Checkbox';
import List from '../stories/components/List';
import ListItem from '../stories/components/ListItem';
import Icon from '../stories/components/Icon';
import ContentText from '../stories/components/ContentText';

/**
 * Primary UI component for user interaction
 * 
 * @param { String } title string
 * @param { String } name string
 * @param { String } type oneOf_'text', 'password'
 * @param { String } defaultValue string
 * @param { String } placeholder string
 * @param { String } value string
 * @param { Element } children element
 * @param { String } errorText string
 * @param { String } description string
 * @param { String } variant oneOf:'outlined', 'border_b','none'
 * @param { String } minHeight oneOf:'small', 'large'
 * @param { Element,String } customStyles oneOfType:string,object
 * @param { Func } onClick func
 * @param { Func } onChange func
 * @param { Func } onKeyPress func
 * @param { String } readOnly string
 * @param { Bool } disabled bool
 */


function SelectiesChannel({title, name, type, defaultValue, placeholder, value, children, errorText, description, variant, minHeight, customStyles,endElement, onChange, onClick, onKeyPress, readOnly, disabled,cancelClick,option}){
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
        
        <div className={`selecties selecties-${minHeight} selecties-${disabled?'disabled':''} ${isTailwind && customStyles} `} style={!isTailwind ? { ...customStyles } : {}}>
           {console.log(value)}
            {children}
            <div className={`selecties-selectiesBar`}>
                <div className={`selecties-selectiesBar-selecties selecties-selectiesBar-${variant}`}>
                    <div className='grid grid-cols-2 gap-4 justify-evenly border-b border-black_tertiary pb-2 '>
                        <div className='grid grid-cols-1 gap-4'>
                            <Headline size='small' title={title} color='black-primary' />
                        </div>
                        <div className='grid grid-cols-2 gap-4  flex-row-reverse'>
                            <div></div>
                            
                            {value ?<Button title='解除' color='alert' onClick={cancelClick}/> : ''}
                        </div>
                    </div>
                    {/* <p>{`${!selectValue ? '' : selectedArrary()}`}</p> */}
                    <List customStyles='' >
                    {value && value.map((data, index) => {
                        return (
                            <ListItem key={index} customStyles='whitespace-nowrap cursor-pointer hover:bg-primary_light h-[36px] list-channel'>
                            <Checkbox 
                            labelColor='black-primary'/>
                            <Icon name={'fb'}/>

                            <ContentText title={data.name} size='normal' color='black-primary' customStyles='mr-[8px]'/>
                            
                            </ListItem>
                        )
                    })}
                        {/* {value ? <ListItem
                            customStyles='whitespace-nowrap cursor-pointer hover:bg-primary_light h-[36px] pl-[0px]'>
                            <Checkbox 
                            labelColor='black-primary'/>
                            <Icon name={'fb'}/>
                            value={value.name}
                        </ListItem> : '尚無頻道' } */}
                        {/* <ListItem
                            customStyles='whitespace-nowrap cursor-pointer hover:bg-primary_light h-[36px] pl-[0px]'>
                            <Checkbox 
                            labelColor='black-primary'/>
                            <Icon name={'fb'}/>

                        </ListItem> */}
                    </List>
                    {/* <div >
                        <Checkbox 
                            content='ddsds'
                            labelColor='black-primary'
                            customStyles='pt-[8px]'
                        />
                        <Checkbox 
                            content='ddsds'
                            labelColor='black-primary'
                            customStyles='pt-[8px]'

                        />
                        <Checkbox 
                            content='ddsds'
                            labelColor='black-primary'
                            customStyles='pt-[8px]'

                        />
                    </div> */}


                </div>


            </div>
        </div>
    )
}

SelectiesChannel.prototype = {
    title: PropTypes.string,
    value: PropTypes.array,
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
    onClick: PropTypes.func,
    onChange: PropTypes.func,
    onKeyPress: PropTypes.func,
    readOnly: PropTypes.string,
    disabled: PropTypes.bool,
    cancelClick: PropTypes.func,
    option: PropTypes.array,

}

SelectiesChannel.defaultProps = {
    title: null,
    value: [
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
    onClick: null,
    onChange: null,
    onKeyPress: null,
    readOnly: null,
    disabled: null,
    cancelClick: null
}

export default SelectiesChannel;