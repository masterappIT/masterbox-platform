import React from 'react'
import PropTypes from 'prop-types'
import Icon from "./Icon";
import ContentText from "./ContentText";

function ErrorText({ title, customStyles,onClick}) {

  const isTailwind = typeof customStyles === 'string';

    return (
        <div className={` errorTxt ${isTailwind && customStyles} `} style={!isTailwind ? { ...customStyles } : {}} onClick={onClick}>
            <Icon name='error' customStyles={{width:'13px',height:'13px',marginRight:'9px'}}/>
            <ContentText title={title} size='small' color='black-tertiary' /> 
        </div>
    )

}

ErrorText.propTypes = {
    title: PropTypes.string,
    customStyles: PropTypes.oneOfType([PropTypes.string, PropTypes.object]), 
    onClick: PropTypes.func,
}

ErrorText.defaultProps = {
    title: 'Error',
    customStyles: null,
    onClick: null,
}

export default ErrorText
