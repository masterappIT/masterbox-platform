import React from 'react'
import PropTypes from 'prop-types'

function Timestamp({ title, variant }) {

    // const bg = `bg-Timestamp_${variant}`
    // backgroundColor_decoration: `bg-Timestamp_decoration_${variant}`

    return (
        <>
            <div className={`timestamp timestamp-${variant}`}>
                {title}
            </div>
        </>
    )

}

Timestamp.propTypes = {
    title: PropTypes.string,
    variant: PropTypes.oneOf(['primary', 'secondary', 'tertiary', 'quaternary'])
}

Timestamp.defaultProps = {
    title: 'Timestamp',
    variant: 'primary',
}

export default Timestamp
