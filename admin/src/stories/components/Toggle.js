import React, { useState,useEffect } from 'react'
import PropTypes from 'prop-types'


/**
 * Primary UI component for user interaction
 * @param { String } color oneOf_'primary', 'secondary', 'tertiary','quaternary'
 * @param { String } status oneOf_'text', 'contained', 'outlined'
 * @param { Element,String } customStyles oneOfType([PropTypes.string, PropTypes.object]),
 * @param { Func } onClick func
 */


function Toggle({ color, status, customStyles, onClick }) {
    const isTailwind = typeof customStyles === 'string';

    const [toggleStatus, setToggleStatus] = useState(false)
    const onToggleStatus = () => {
        setToggleStatus(!toggleStatus)
    }
    useEffect(() => {
        setToggleStatus(status)

    }, [status])


    return (
        <div className={`toggle toggle-${toggleStatus ? 'primary' : 'secondary'} ${isTailwind && customStyles} `} style={!isTailwind ? { ...customStyles } : {}} onClick={onToggleStatus}>
            <div className={`toggle-status toggle-${toggleStatus ? 'primary-' : 'secondary-'}status`} />
        </div>
    )

}

Toggle.propTypes = {
    variant: PropTypes.oneOf(['primary', 'secondary']),
    customStyles: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
    onClick: PropTypes.func,
}

Toggle.defaultProps = {
    status: 'primary',
    customStyles: null,
    onClick: null,
}

export default Toggle
