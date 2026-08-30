import React from 'react'
import PropTypes from 'prop-types'


/**
 * Primary UI component for user interaction
 *  * 
 * @param { String } title oneOf_'text', 'contained', 'outlined'
 * @param { String } color oneOf_'primary', 'secondary', 'tertiary','quaternary'
 * @param { String } variant oneOf_'text', 'contained', 'outlined'
 * @param { Element,String } customStyles oneOfType([PropTypes.string, PropTypes.object]),
 * @param { Func } onClick func
 */


function Label({ title, color ,variant, customStyles, onClick}) {
    const isTailwind = typeof customStyles === 'string';

    return (
        <div className={`label label-${variant}-${color} ${isTailwind && customStyles} `} style={!isTailwind ? { ...customStyles } : {}} onClick={onClick}>
            <div className={`label-decoration label-decoration-${color}`} />
            <p >
                {title}
            </p>
        </div>
    )

}

Label.propTypes = {
    title: PropTypes.string,
    color: PropTypes.oneOf(['primary', 'secondary', 'tertiary','quaternary']),
    border: PropTypes.oneOf(['light', 'normal', 'bold']),
    variant: PropTypes.oneOf(['text', 'contained', 'outlined']),
    customStyles: PropTypes.oneOfType([PropTypes.string, PropTypes.object]), 
    onClick: PropTypes.func,
}

Label.defaultProps = {
    title: 'Label',
    color: 'primary',
    border:'light',
    variant:'contained',
    customStyles: null,
    onClick: null,
}

export default Label
