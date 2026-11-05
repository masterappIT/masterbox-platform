import React, { useState,useEffect } from 'react'
import PropTypes from 'prop-types'


/**
 * Primary UI component for user interaction
 * @param { String } color oneOf_'primary', 'secondary', 'tertiary','quaternary'
 * @param { String } status oneOf_'text', 'contained', 'outlined'
 * @param { Element,String } customStyles oneOfType([PropTypes.string, PropTypes.object]),
 * @param { Func } onClick func
 */


function Toggle({ color, status, customStyles, onClick, disabled, label }) {
    const isTailwind = typeof customStyles === 'string';

    const [toggleStatus, setToggleStatus] = useState(false)
    useEffect(() => {
        setToggleStatus(status)

    }, [status])

    // With onClick the caller owns the value: it shows `status` until the caller changes it.
    const isOn = onClick ? Boolean(status) : Boolean(toggleStatus)
    const onToggleStatus = () => {
        if (disabled) return
        if (onClick) onClick(!isOn)
        else setToggleStatus(!toggleStatus)
    }
    const onKeyDown = (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        onToggleStatus()
    }


    return (
        <div role='switch' aria-checked={isOn} aria-disabled={Boolean(disabled)} aria-label={label} tabIndex={0}
            className={`toggle toggle-${isOn ? 'primary' : 'secondary'} ${disabled ? 'opacity-50 cursor-wait' : ''} ${isTailwind && customStyles} `} style={!isTailwind ? { ...customStyles } : {}} onClick={onToggleStatus} onKeyDown={onKeyDown}>
            <div className={`toggle-status toggle-${isOn ? 'primary-' : 'secondary-'}status`} />
        </div>
    )

}

Toggle.propTypes = {
    variant: PropTypes.oneOf(['primary', 'secondary']),
    customStyles: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
    onClick: PropTypes.func,
    disabled: PropTypes.bool,
    label: PropTypes.string,
}

Toggle.defaultProps = {
    status: 'primary',
    customStyles: null,
    onClick: null,
    disabled: false,
    label: undefined,
}

export default Toggle
