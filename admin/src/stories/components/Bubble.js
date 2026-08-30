import React from 'react'
import PropTypes from 'prop-types'
import ContentText from './ContentText';

function Bubble({ contents, color, customStyles, onClick }) {

    // const bg = `bg-bubble_${variant}`
    // backgroundColor_decoration: `bg-bubble_decoration_${variant}`
    const isTailwind = typeof customStyles === 'string';

    return (
        <>
            <div className={`bubble bubble-${color} ${isTailwind && customStyles} `} style={!isTailwind ? { ...customStyles } : {}} onClick={onClick}>
                {/* <ContentText title={contents} customStyles='w-full'/> */}
                {contents}
            </div>
        </>
    )

}

Bubble.propTypes = {
    contents: PropTypes.string || PropTypes.array,
    variant: PropTypes.oneOf(['primary', 'secondary', 'tertiary', 'quaternary']),
    customStyles: PropTypes.oneOfType([PropTypes.string, PropTypes.object]), 
    onClick: PropTypes.func,
}

Bubble.defaultProps = {
    contents: 'bubble',
    color: 'primary',
    customStyles: null,
    onClick: null,
}

export default Bubble
