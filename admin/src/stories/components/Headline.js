import React from 'react'
import PropTypes from 'prop-types'

/**
 * Primary UI component for user interaction
 * 
 * @param { String } title string
 * @param { String } color oneOf_'primary', 'secondary', 'alert','white','black-primary', 'black-secondary', 'black-tertiary', 'black-quaternary'
 * @param { String } size oneOf_'small','normal','medium','large'
 * @param { Element,String } customStyles oneOfType([PropTypes.string, PropTypes.object]),
 * @param { Func } onClick func
 *
 */

function Headline({ title, color ,size, customStyles, onClick }) {

    const isTailwind = typeof customStyles === 'string';

    return (
            <div className={`headline headline-${color} headline-${size} ${isTailwind && customStyles} `} style={!isTailwind ? { ...customStyles } : {}} onClick={onClick}>
                {title}
            </div>
    );

};

Headline.propTypes = {
    title: PropTypes.string,
    color: PropTypes.oneOf(['primary', 'secondary', 'alert','white','black-primary', 'black-secondary', 'black-tertiary', 'black-quaternary']),
    size: PropTypes.oneOf(['small','normal','medium','large']),
    customStyles: PropTypes.oneOfType([PropTypes.string, PropTypes.object]), 
    onClick: PropTypes.func,
}

Headline.defaultProps = {
    title: 'Headline',
    color: 'black-primary',
    size:'normal',
    customStyles: null,
    onClick: null,
}

export default Headline;
