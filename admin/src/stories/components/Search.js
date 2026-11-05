import React, { useState } from 'react'
import PropTypes from 'prop-types'

/**
 * Search field from the design: a 16px icon over a thin underline.
 */
function Search({ placeholder, customStyles, onChange }) {
    const isTailwind = typeof customStyles === 'string';
    const [searchInput, setSearchInput] = useState('');

    const onInputChange = (e) => {
        const value = e.target.value;
        setSearchInput(value);
        if (onChange) onChange(value);
    };

    return (
        <label className={`search ${isTailwind ? customStyles : ''}`} style={!isTailwind ? { ...customStyles } : {}}>
            <img className='search-icon' src='/design/ui/search.svg' alt='' width={16} height={16} />
            <input className='search-input' type='text' name='search' aria-label={placeholder} placeholder={placeholder} value={searchInput} onChange={onInputChange} />
        </label>
    )
}

Search.propTypes = {
    placeholder: PropTypes.string,
    customStyles: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
    onChange: PropTypes.func,
}

Search.defaultProps = {
    placeholder: '搜尋',
    customStyles: null,
    onChange: null,
}

export default Search
