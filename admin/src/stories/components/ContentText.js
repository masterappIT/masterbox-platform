import React from 'react'
import PropTypes from 'prop-types'


/**
 * Primary UI component for user interaction
 * 
 * @param { String } title string
 * @param { String } color oneOf_'primary', 'secondary', 'alert','white','black-primary', 'black-secondary', 'black-tertiary', 'black-quaternary'
 * @param { String } size oneOf_'small','normal','large'
 * @param { Element,String } customStyles oneOfType([PropTypes.string, PropTypes.object]),
 * @param { Func } onClick func
 *
 */

function ContentText({ title, color,size , customStyles, onClick }) {
    const isTailwind = typeof customStyles === 'string'
    return (
            <div className={`contentText contentText-${color} contentText-${size} ${isTailwind && customStyles} `} style={!isTailwind ? { ...customStyles } : {}} onClick={onClick}>
                {title}
            </div>
    )

}

ContentText.propTypes = {
    title: PropTypes.string,
    color: PropTypes.oneOf(['primary', 'secondary', 'alert','white','black-primary', 'black-secondary', 'black-tertiary', 'black-quaternary']),
    size: PropTypes.oneOf(['small','normal','large']),
    customStyles: PropTypes.oneOfType([PropTypes.string, PropTypes.object]), 
    onClick: PropTypes.func,
}

ContentText.defaultProps = {
    title: 'ContentText',
    color: 'black-primary',
    size: 'normal',
    customStyles: null,
    onClick: null,
}

export default ContentText
